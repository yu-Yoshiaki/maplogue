// Vite dev サーバーに同居する API プラグイン（ローカル専用）。
//   GET  /api/workspaces : ワークスペース一覧を返す
//   POST /api/workspaces : 新しいワークスペースを作成する
//   POST /api/input : 選択ワークスペースの inbox.jsonl に追記（id 重複は冪等に成功を返す）
//   GET  /api/scene : scene.json + pins.json + 未処理件数 + worker status を合成して返す。
//   GET  /api/history : history.json を返す
//                     scene.json が壊れているときは最後の正常値を stale: true で返す
//   POST /api/pin   : 選択ワークスペースの pins.json に保存（tmp→rename でアトミック）
//
// 書き手の分離が同時書き込み対策の要:
//   scene.json / history.json = 監視セッション専有、pins.json = このサーバー専有、
//   inbox.jsonl = このサーバーが追記・監視セッションは読むだけ。
//   scene-watch-status.json = 監視デーモン専有（runtime。Git 対象外）。

import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import type { Plugin } from "vite";
import {
  parseSceneWatchRuntimeStatus,
  toSceneWorkerStatus,
} from "../src/reflection/parseRuntimeStatus";
import { validateScene } from "../src/scene/validateScene";
import {
  isOrganizeMode,
  type History,
  type InboxEntry,
  type OrganizeMode,
  type PinPosition,
  type Pins,
  type Scene,
  type SceneWorkerStatus,
  type WorkspaceSummary,
} from "../src/types/scene";

const MAX_POST_BYTES = 64 * 1024;
const DEFAULT_WORKSPACE_ID = "default";

const INITIAL_SCENE: Scene = { version: 1, title: "", updatedAt: "", items: [], edges: [] };
const INITIAL_HISTORY: History = { processedInputIds: [], batches: [] };

interface WorkspaceMeta {
  id: string;
  name: string;
  createdAt: string;
}

interface WorkspaceRegistry {
  workspaces: WorkspaceMeta[];
}

interface WorkspaceFiles {
  id: string;
  dir: string;
  scenePath: string;
  inboxPath: string;
  historyPath: string;
  pinsPath: string;
}

/**
 * pins.json の1エントリを v2 `{x,y,parentId}` へ normalize する。
 * 旧形式 `{x,y}` は parentId: null（トップレベル絶対座標）とみなす。
 * 不正なエントリは落とす。
 */
export function normalizePinEntry(value: unknown): PinPosition | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const rec = value as Record<string, unknown>;
  const x = typeof rec.x === "number" && Number.isFinite(rec.x) ? rec.x : null;
  const y = typeof rec.y === "number" && Number.isFinite(rec.y) ? rec.y : null;
  if (x === null || y === null) return null;
  if (!("parentId" in rec) || rec.parentId === undefined) {
    return { x, y, parentId: null };
  }
  if (rec.parentId === null) return { x, y, parentId: null };
  if (typeof rec.parentId === "string") return { x, y, parentId: rec.parentId };
  return null;
}

/** 旧形式を含む pins.json 全体を v2 Pins へ normalize する */
export function normalizePins(raw: unknown): Pins {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const out: Pins = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const pin = normalizePinEntry(value);
    if (pin) out[id] = pin;
  }
  return out;
}

/** POST /api/pin の parentId。未指定は null（トップレベル） */
export function parsePinParentId(value: unknown): string | null | undefined {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === "string") return value;
  return undefined;
}

/** POST /api/input の mode。未指定は normal。未知値は null */
export function parseOrganizeMode(value: unknown): OrganizeMode | null {
  if (value === undefined || value === null || value === "") return "normal";
  return isOrganizeMode(value) ? value : null;
}

export function parseWorkspaceId(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return DEFAULT_WORKSPACE_ID;
  if (typeof value !== "string") return null;
  return /^[a-z0-9][a-z0-9_-]{0,39}$/.test(value) ? value : null;
}

function parseWorkspaceName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  if (name.length < 1 || name.length > 40) return null;
  return name;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

/** 64KB を超えたら null */
async function readBody(req: IncomingMessage): Promise<string | null> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    total += buf.length;
    if (total > MAX_POST_BYTES) return null;
    chunks.push(buf);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function isPrivateOrTailscaleHost(host: string): boolean {
  const parts = host.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a, b] = parts;
  return (
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

function isAllowedWriteHost(host: string): boolean {
  if (host === "127.0.0.1" || host === "localhost") return true;
  return process.env.REALTIME_DRAW_ALLOW_REMOTE_WRITE === "1" && isPrivateOrTailscaleHost(host);
}

/** 状態変更系は通常ローカルのみ。明示 env 有効時だけ private/Tailscale 経由を許可する */
export function isAllowedWriteRequest(req: IncomingMessage): boolean {
  const host = (req.headers.host ?? "").split(":")[0];
  if (!isAllowedWriteHost(host)) return false;
  const origin = req.headers.origin;
  if (typeof origin === "string" && origin !== "") {
    try {
      const originHost = new URL(origin).hostname;
      if (!isAllowedWriteHost(originHost)) return false;
    } catch {
      return false;
    }
  }
  return true;
}

export function sceneApiPlugin(): Plugin {
  return {
    name: "scene-api",
    apply: "serve",
    configureServer(server) {
      const dataDir = path.resolve(server.config.root, "data");
      const registryPath = path.join(dataDir, "workspaces.json");
      const workspacesDir = path.join(dataDir, "workspaces");

      const sceneCache = new Map<string, Scene>();
      // pins.json への書き込みを直列化するキュー
      let pinsQueue: Promise<void> = Promise.resolve();

      const ensureFile = async (filePath: string, content: string) => {
        try {
          await fs.access(filePath);
        } catch {
          await fs.writeFile(filePath, content, "utf8");
        }
      };

      const workspaceFiles = (workspaceId: string): WorkspaceFiles => {
        const dir =
          workspaceId === DEFAULT_WORKSPACE_ID
            ? dataDir
            : path.join(workspacesDir, workspaceId);
        return {
          id: workspaceId,
          dir,
          scenePath: path.join(dir, "scene.json"),
          inboxPath: path.join(dir, "inbox.jsonl"),
          historyPath: path.join(dir, "history.json"),
          pinsPath: path.join(dir, "pins.json"),
        };
      };

      const ensureWorkspaceFiles = async (files: WorkspaceFiles) => {
        await fs.mkdir(files.dir, { recursive: true });
        await ensureFile(files.scenePath, `${JSON.stringify(INITIAL_SCENE, null, 2)}\n`);
        await ensureFile(files.inboxPath, "");
        await ensureFile(files.historyPath, `${JSON.stringify(INITIAL_HISTORY, null, 2)}\n`);
        await ensureFile(files.pinsPath, "{}\n");
      };

      const ready = (async () => {
        await fs.mkdir(dataDir, { recursive: true });
        await fs.mkdir(workspacesDir, { recursive: true });
        await ensureFile(registryPath, `${JSON.stringify({ workspaces: [] }, null, 2)}\n`);
        await ensureWorkspaceFiles(workspaceFiles(DEFAULT_WORKSPACE_ID));
      })();

      const readRegistry = async (): Promise<WorkspaceRegistry> => {
        try {
          const parsed = JSON.parse(await fs.readFile(registryPath, "utf8")) as unknown;
          if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
            return { workspaces: [] };
          }
          const rawWorkspaces = (parsed as { workspaces?: unknown }).workspaces;
          if (!Array.isArray(rawWorkspaces)) return { workspaces: [] };
          const workspaces = rawWorkspaces.filter((entry): entry is WorkspaceMeta => {
            if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return false;
            const rec = entry as Record<string, unknown>;
            return (
              parseWorkspaceId(rec.id) === rec.id &&
              rec.id !== DEFAULT_WORKSPACE_ID &&
              typeof rec.name === "string" &&
              typeof rec.createdAt === "string"
            );
          });
          return { workspaces };
        } catch {
          return { workspaces: [] };
        }
      };

      const writeRegistry = async (registry: WorkspaceRegistry) => {
        const tmpPath = `${registryPath}.tmp`;
        await fs.writeFile(tmpPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
        await fs.rename(tmpPath, registryPath);
      };

      const workspaceExists = async (workspaceId: string): Promise<boolean> => {
        if (workspaceId === DEFAULT_WORKSPACE_ID) return true;
        const registry = await readRegistry();
        return registry.workspaces.some((workspace) => workspace.id === workspaceId);
      };

      const resolveWorkspace = async (
        value: unknown,
        res: ServerResponse,
      ): Promise<WorkspaceFiles | null> => {
        const workspaceId = parseWorkspaceId(value);
        if (workspaceId === null) {
          sendJson(res, 400, { error: "workspaceId is invalid" });
          return null;
        }
        if (!(await workspaceExists(workspaceId))) {
          sendJson(res, 404, { error: "workspace not found" });
          return null;
        }
        const files = workspaceFiles(workspaceId);
        await ensureWorkspaceFiles(files);
        return files;
      };

      const readSceneSafe = async (
        files: WorkspaceFiles,
      ): Promise<{ scene: Scene; stale: boolean } | null> => {
        try {
          const raw = await fs.readFile(files.scenePath, "utf8");
          const parsed = JSON.parse(raw) as unknown;
          const errors = validateScene(parsed);
          if (errors.length > 0) throw new Error(errors.join("; "));
          sceneCache.set(files.id, parsed as Scene);
          return { scene: parsed as Scene, stale: false };
        } catch {
          const cached = sceneCache.get(files.id);
          return cached ? { scene: cached, stale: true } : null;
        }
      };

      const readPinsSafe = async (files: WorkspaceFiles): Promise<Pins> => {
        try {
          const parsed = JSON.parse(await fs.readFile(files.pinsPath, "utf8")) as unknown;
          return normalizePins(parsed);
        } catch {
          return {};
        }
      };

      const readInboxEntries = async (files: WorkspaceFiles): Promise<InboxEntry[]> => {
        const raw = await fs.readFile(files.inboxPath, "utf8").catch(() => "");
        const entries: InboxEntry[] = [];
        for (const line of raw.split("\n")) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line) as InboxEntry;
            if (typeof parsed.id === "string") entries.push(parsed);
          } catch {
            // 壊れた行はスキップ
          }
        }
        return entries;
      };

      const readHistorySafe = async (files: WorkspaceFiles): Promise<History> => {
        try {
          const parsed = JSON.parse(await fs.readFile(files.historyPath, "utf8")) as History;
          return {
            processedInputIds: Array.isArray(parsed.processedInputIds)
              ? parsed.processedInputIds.filter((id): id is string => typeof id === "string")
              : [],
            batches: Array.isArray(parsed.batches) ? parsed.batches : [],
          };
        } catch {
          return INITIAL_HISTORY;
        }
      };

      const countPending = async (files: WorkspaceFiles): Promise<number> => {
        const entries = await readInboxEntries(files);
        let processed: Set<string>;
        try {
          const history = await readHistorySafe(files);
          processed = new Set(history.processedInputIds ?? []);
        } catch {
          processed = new Set();
        }
        return entries.filter((e) => !processed.has(e.id)).length;
      };

      const summarizeWorkspace = async (
        workspaceId: string,
        name: string,
        isDefault: boolean,
      ): Promise<WorkspaceSummary> => {
        const files = workspaceFiles(workspaceId);
        await ensureWorkspaceFiles(files);
        const result = await readSceneSafe(files);
        return {
          id: workspaceId,
          name,
          sceneTitle: result?.scene.title ?? "",
          updatedAt: result?.scene.updatedAt ?? "",
          isDefault,
        };
      };

      const readWorkspaceSummaries = async (): Promise<WorkspaceSummary[]> => {
        const registry = await readRegistry();
        return Promise.all([
          summarizeWorkspace(DEFAULT_WORKSPACE_ID, "Default", true),
          ...registry.workspaces.map((workspace) =>
            summarizeWorkspace(workspace.id, workspace.name, false),
          ),
        ]);
      };

      const handleWorkspaces = async (res: ServerResponse) => {
        sendJson(res, 200, { workspaces: await readWorkspaceSummaries() });
      };

      const handleCreateWorkspace = async (payload: Record<string, unknown>, res: ServerResponse) => {
        const name = parseWorkspaceName(payload.name);
        if (name === null) {
          sendJson(res, 400, { error: "name must be a 1-40 character string" });
          return;
        }
        const registry = await readRegistry();
        let id = "";
        do {
          id = `ws_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
        } while (registry.workspaces.some((workspace) => workspace.id === id));
        const workspace: WorkspaceMeta = { id, name, createdAt: new Date().toISOString() };
        registry.workspaces.push(workspace);
        await writeRegistry(registry);
        await ensureWorkspaceFiles(workspaceFiles(id));
        sendJson(res, 201, { workspaces: await readWorkspaceSummaries(), workspace });
      };

      const handleHistory = async (files: WorkspaceFiles, res: ServerResponse) => {
        sendJson(res, 200, { history: await readHistorySafe(files) });
      };

      const readWorkerStatus = async (workspaceId: string): Promise<SceneWorkerStatus | null> => {
        const statusPath = path.join(dataDir, "scene-watch-status.json");
        try {
          const raw = JSON.parse(await fs.readFile(statusPath, "utf8")) as unknown;
          const runtime = parseSceneWatchRuntimeStatus(raw);
          // 壊れている / 無い場合は未起動相当の null。正常に見せる補完はしない。
          return toSceneWorkerStatus(runtime, workspaceId);
        } catch {
          return null;
        }
      };

      const handleScene = async (files: WorkspaceFiles, res: ServerResponse) => {
        const result = await readSceneSafe(files);
        if (!result) {
          sendJson(res, 503, { error: "scene.json が不正で、返せる正常なキャッシュがありません" });
          return;
        }
        const [pins, pendingInputs, workerStatus] = await Promise.all([
          readPinsSafe(files),
          countPending(files),
          readWorkerStatus(files.id),
        ]);
        sendJson(res, 200, {
          scene: result.scene,
          pins,
          pendingInputs,
          workerStatus,
          ...(result.stale ? { stale: true } : {}),
        });
      };

      const handleInput = async (
        files: WorkspaceFiles,
        payload: Record<string, unknown>,
        res: ServerResponse,
      ) => {
        const text = typeof payload.text === "string" ? payload.text.trim() : "";
        if (!text) {
          sendJson(res, 400, { error: "text is required" });
          return;
        }
        const mode = parseOrganizeMode(payload.mode);
        if (mode === null) {
          sendJson(res, 400, { error: "mode must be one of normal, todo, discussion, compare" });
          return;
        }
        const id =
          typeof payload.id === "string" && /^in_[A-Za-z0-9_-]{4,64}$/.test(payload.id)
            ? payload.id
            : `in_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;

        const existing = await readInboxEntries(files);
        if (existing.some((e) => e.id === id)) {
          // クライアントのリトライ。二重登録せず成功を返す
          sendJson(res, 200, { ok: true, id, duplicate: true });
          return;
        }
        const entry: InboxEntry = { id, text, mode, createdAt: new Date().toISOString() };
        await fs.appendFile(files.inboxPath, `${JSON.stringify(entry)}\n`, "utf8");
        sendJson(res, 201, { ok: true, id });
      };

      const handlePin = async (
        files: WorkspaceFiles,
        payload: Record<string, unknown>,
        res: ServerResponse,
      ) => {
        const id = typeof payload.id === "string" ? payload.id : "";
        if (!id) {
          sendJson(res, 400, { error: "id is required" });
          return;
        }
        const remove = payload.x === null;
        const x = typeof payload.x === "number" && Number.isFinite(payload.x) ? payload.x : null;
        const y = typeof payload.y === "number" && Number.isFinite(payload.y) ? payload.y : null;
        if (!remove && (x === null || y === null)) {
          sendJson(res, 400, { error: "x and y must be finite numbers (or x: null to unpin)" });
          return;
        }
        const parentId = parsePinParentId(payload.parentId);
        if (!remove && parentId === undefined) {
          sendJson(res, 400, { error: "parentId must be a string or null" });
          return;
        }
        const task = pinsQueue.then(async () => {
          const pins = await readPinsSafe(files);
          if (remove) {
            // unpin は既存どおり x: null で削除。parentId は不要
            delete pins[id];
          } else {
            pins[id] = { x: x as number, y: y as number, parentId: parentId as string | null };
          }
          const tmpPath = `${files.pinsPath}.tmp`;
          await fs.writeFile(tmpPath, `${JSON.stringify(pins, null, 2)}\n`, "utf8");
          await fs.rename(tmpPath, files.pinsPath);
        });
        pinsQueue = task.catch(() => {});
        await task;
        sendJson(res, 200, { ok: true });
      };

      server.middlewares.use((req, res, next) => {
        const requestUrl = new URL(req.url ?? "/", "http://localhost");
        if (!requestUrl.pathname.startsWith("/api/")) {
          next();
          return;
        }
        void (async () => {
          await ready;
          if (req.method === "GET" && requestUrl.pathname === "/api/workspaces") {
            await handleWorkspaces(res);
            return;
          }
          if (req.method === "GET" && requestUrl.pathname === "/api/scene") {
            const files = await resolveWorkspace(requestUrl.searchParams.get("workspaceId"), res);
            if (files) await handleScene(files, res);
            return;
          }
          if (req.method === "GET" && requestUrl.pathname === "/api/history") {
            const files = await resolveWorkspace(requestUrl.searchParams.get("workspaceId"), res);
            if (files) await handleHistory(files, res);
            return;
          }
          if (
            req.method === "POST" &&
            (requestUrl.pathname === "/api/input" ||
              requestUrl.pathname === "/api/pin" ||
              requestUrl.pathname === "/api/workspaces")
          ) {
            if (!isAllowedWriteRequest(req)) {
              sendJson(res, 403, { error: "local requests only" });
              return;
            }
            const raw = await readBody(req);
            if (raw === null) {
              sendJson(res, 413, { error: "request body is too large" });
              return;
            }
            let payload: unknown;
            try {
              payload = JSON.parse(raw);
            } catch {
              sendJson(res, 400, { error: "request body must be JSON" });
              return;
            }
            if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
              sendJson(res, 400, { error: "request body must be a JSON object" });
              return;
            }
            const record = payload as Record<string, unknown>;
            if (requestUrl.pathname === "/api/workspaces") {
              await handleCreateWorkspace(record, res);
              return;
            }
            const files = await resolveWorkspace(record.workspaceId, res);
            if (!files) return;
            if (requestUrl.pathname === "/api/input") {
              await handleInput(files, record, res);
            } else {
              await handlePin(files, record, res);
            }
            return;
          }
          const knownEndpoints = new Set([
            "/api/scene",
            "/api/history",
            "/api/input",
            "/api/pin",
            "/api/workspaces",
          ]);
          sendJson(res, knownEndpoints.has(requestUrl.pathname) ? 405 : 404, {
            error: requestUrl.pathname.startsWith("/api/")
              ? "method not allowed or unknown endpoint"
              : "not found",
          });
        })().catch((error: unknown) => {
          sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
        });
      });
    },
  };
}
