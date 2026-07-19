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

/** GET /api/scene のレスポンス */
export interface SceneResponse {
  scene: Scene;
  pins: Pins;
  /** inbox のうち history 未記録の入力件数 */
  pendingInputs: number;
  /** scene.json がパース/検証に失敗し、最後の正常値を返しているとき true */
  stale?: boolean;
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
