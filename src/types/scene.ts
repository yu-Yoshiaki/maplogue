// scene.json のスキーマの正。監視セッション（skills/scene-watch-start.md）もこの型に従う。

export type ItemType = "card" | "note" | "list" | "table" | "group";

export interface ItemBase {
  /** 採番規則: `${type}_` + 3桁以上の連番（例 card_001）。欠番再利用禁止 */
  id: string;
  type: ItemType;
  /** 所属 group の id。group 自身には付けない（入れ子は非対応） */
  groupId?: string;
}

export interface CardItem extends ItemBase {
  type: "card";
  title: string;
  body?: string;
}

/** 注意書き。付箋風の見た目で描画される */
export interface NoteItem extends ItemBase {
  type: "note";
  text: string;
  tone?: "warning" | "info";
}

export interface ListItem extends ItemBase {
  type: "list";
  title?: string;
  items: string[];
}

export interface TableItem extends ItemBase {
  type: "table";
  title?: string;
  columns: string[];
  rows: string[][];
}

/** メンバーは他 item の groupId で表現する。group 側はメンバー一覧を持たない */
export interface GroupItem extends ItemBase {
  type: "group";
  title: string;
}

export type SceneItem = CardItem | NoteItem | ListItem | TableItem | GroupItem;

export interface SceneEdge {
  /** edge_001 形式 */
  id: string;
  source: string;
  target: string;
  label?: string;
  /**
   * この関係を結んだ短い根拠（入力・発言の要約）。
   * UI で線をクリックすると表示する。無くてもよい（後方互換）。
   */
  evidence?: string;
}

export interface Scene {
  /** 監視セッションが編集のたびに +1。ポーリングの変更検知に使う */
  version: number;
  /** キャンバスの主題。最初の入力から AI が命名する */
  title: string;
  /** ISO8601 */
  updatedAt: string;
  items: SceneItem[];
  edges: SceneEdge[];
}

/** ユーザーがドラッグで固定したノード座標。parentId は座標系（トップレベル=null / group 子=親 id） */
export interface PinPosition {
  x: number;
  y: number;
  parentId: string | null;
}

/** data/pins.json（サーバー専有）。旧形式 {x,y} は読み取り時に parentId:null へ normalize する */
export type Pins = Record<string, PinPosition>;

/**
 * 監視デーモンが data/scene-watch-status.json に atomic 書き込みする runtime status。
 * Git 管理対象外（data/*）。
 */
export interface SceneWatchRuntimeStatus {
  /** ISO8601。デーモンの生存心拍 */
  heartbeatAt: string;
  /** 直近バッチの開始時刻。未開始なら null */
  batchStartedAt: string | null;
  /** 直近バッチの成功時刻。未成功なら null */
  batchSucceededAt: string | null;
  /** 直近バッチの失敗時刻。未失敗なら null */
  batchFailedAt: string | null;
  /** 直近/進行中バッチの対象ワークスペース id（default を含む） */
  workspaceIds: string[];
}

/** 選択中ワークスペース向けに投影した worker status（GET /api/scene） */
export interface SceneWorkerStatus {
  heartbeatAt: string;
  batchStartedAt: string | null;
  batchSucceededAt: string | null;
  batchFailedAt: string | null;
  /** 選択中ワークスペースが直近/進行中バッチの対象に含まれるか */
  includesWorkspace: boolean;
}

/** GET /api/scene のレスポンス */
export interface SceneResponse {
  scene: Scene;
  pins: Pins;
  /** inbox のうち history 未記録の入力件数 */
  pendingInputs: number;
  /** scene.json がパース/検証に失敗し、最後の正常値を返しているとき true */
  stale?: boolean;
  /**
   * 監視デーモンの runtime status。未起動・ファイル無し・壊れているときは null。
   * 壊れた status を正常に見せるフォールバックはしない。
   */
  workerStatus: SceneWorkerStatus | null;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  sceneTitle: string;
  updatedAt: string;
  isDefault: boolean;
}

export interface WorkspacesResponse {
  workspaces: WorkspaceSummary[];
}

export interface CreateWorkspaceResponse extends WorkspacesResponse {
  workspace: {
    id: string;
    name: string;
    createdAt: string;
  };
}

export interface HistoryResponse {
  history: History;
}

/** data/history.json（監視セッション専有） */
export interface History {
  processedInputIds: string[];
  batches: HistoryBatch[];
}

export interface HistoryBatch {
  /** batch_001 形式 */
  id: string;
  inputIds: string[];
  sceneVersionBefore: number;
  sceneVersionAfter: number;
  changedItemIds: string[];
  summary: string;
  createdAt: string;
}

/** 入力の AI 整理方針。scene.json には保存しない */
export type OrganizeMode = "normal" | "todo" | "discussion" | "compare";

export const ORGANIZE_MODES: readonly OrganizeMode[] = [
  "normal",
  "todo",
  "discussion",
  "compare",
] as const;

export function isOrganizeMode(value: unknown): value is OrganizeMode {
  return typeof value === "string" && (ORGANIZE_MODES as readonly string[]).includes(value);
}

/** data/inbox.jsonl の1行 */
export interface InboxEntry {
  id: string;
  text: string;
  /** 後方互換のため optional。無い行は監視セッションが normal として扱う */
  mode?: OrganizeMode;
  createdAt: string;
}
