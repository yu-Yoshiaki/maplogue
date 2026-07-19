// data/scene-watch-status.json の厳密パース。壊れた内容は null（正常に見せない）。

import type { SceneWatchRuntimeStatus, SceneWorkerStatus } from "../types/scene";

function readIso(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? value : null;
}

function readWorkspaceIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const ids: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string" || entry.trim() === "") return null;
    ids.push(entry);
  }
  return ids;
}

/** runtime status JSON を厳密にパースする。欠損・破壊時は null */
export function parseSceneWatchRuntimeStatus(raw: unknown): SceneWatchRuntimeStatus | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  const heartbeatAt = readIso(rec.heartbeatAt);
  if (!heartbeatAt) return null;

  const workspaceIds = readWorkspaceIds(rec.workspaceIds);
  if (workspaceIds === null) return null;

  // 明示 null は可。不正文字列や欠落した必須キーは拒否。
  if (!("batchStartedAt" in rec) || !("batchSucceededAt" in rec) || !("batchFailedAt" in rec)) {
    return null;
  }

  const batchStartedAt =
    rec.batchStartedAt === null ? null : readIso(rec.batchStartedAt);
  const batchSucceededAt =
    rec.batchSucceededAt === null ? null : readIso(rec.batchSucceededAt);
  const batchFailedAt = rec.batchFailedAt === null ? null : readIso(rec.batchFailedAt);

  if (rec.batchStartedAt !== null && batchStartedAt === null) return null;
  if (rec.batchSucceededAt !== null && batchSucceededAt === null) return null;
  if (rec.batchFailedAt !== null && batchFailedAt === null) return null;

  return {
    heartbeatAt,
    batchStartedAt,
    batchSucceededAt,
    batchFailedAt,
    workspaceIds,
  };
}

/** 選択ワークスペース向けに API 用 worker status へ投影する */
export function toSceneWorkerStatus(
  runtime: SceneWatchRuntimeStatus | null,
  workspaceId: string,
): SceneWorkerStatus | null {
  if (!runtime) return null;
  return {
    heartbeatAt: runtime.heartbeatAt,
    batchStartedAt: runtime.batchStartedAt,
    batchSucceededAt: runtime.batchSucceededAt,
    batchFailedAt: runtime.batchFailedAt,
    includesWorkspace: runtime.workspaceIds.includes(workspaceId),
  };
}
