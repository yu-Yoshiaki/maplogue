// 自動レイアウト（「図が暴れない」要件の中核）。
// - トップレベルブロックは3列マソンリー（最短列の末尾に追加）
// - group 内は縦積み（親相対座標）
// - items 配列順に対して決定的: 同じ scene.json なら常に同じ配置になる
// - 高さは内容からの概算。実レンダリングとのズレは列詰めが甘くなるだけで許容する

import type { Scene, SceneItem } from "../types/scene";

export const NODE_WIDTH = 280;
export const COLUMNS = 3;
export const COLUMN_GAP = 32;
export const ROW_GAP = 32;
export const GROUP_PADDING_X = 16;
export const GROUP_HEADER_HEIGHT = 44;
export const GROUP_PADDING_BOTTOM = 16;
export const GROUP_CHILD_GAP = 12;
export const GROUP_WIDTH = NODE_WIDTH + GROUP_PADDING_X * 2;

const COLUMN_WIDTH = GROUP_WIDTH;
const CHARS_PER_LINE = 18; // 幅280px・日本語主体での概算
const LINE_HEIGHT = 21;

function textLines(text: string, charsPerLine = CHARS_PER_LINE): number {
  return text
    .split("\n")
    .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
}

export function estimateItemHeight(item: SceneItem): number {
  switch (item.type) {
    case "card": {
      const titleH = textLines(item.title) * 24;
      const bodyH = item.body ? 8 + textLines(item.body) * LINE_HEIGHT : 0;
      return 28 + titleH + bodyH;
    }
    case "note":
      return 28 + textLines(item.text) * LINE_HEIGHT;
    case "list": {
      const titleH = item.title ? textLines(item.title) * 24 + 6 : 0;
      const itemsH = item.items.reduce((sum, li) => sum + textLines(li, 16) * 22, 0);
      return 28 + titleH + itemsH;
    }
    case "table": {
      const titleH = item.title ? textLines(item.title) * 24 + 6 : 0;
      return 28 + titleH + (item.rows.length + 1) * 32;
    }
    case "group":
      // group の高さは layoutScene 側で子から計算する
      return GROUP_HEADER_HEIGHT + GROUP_PADDING_BOTTOM;
  }
}

export interface LayoutResult {
  /** item id → 座標。group 子は親相対、それ以外はキャンバス絶対 */
  positions: Map<string, { x: number; y: number }>;
  /** group id → サイズ */
  sizes: Map<string, { width: number; height: number }>;
}

export function layoutScene(scene: Scene): LayoutResult {
  const positions = new Map<string, { x: number; y: number }>();
  const sizes = new Map<string, { width: number; height: number }>();

  const groupIdSet = new Set(scene.items.filter((i) => i.type === "group").map((i) => i.id));
  const isGroupedChild = (item: SceneItem): boolean =>
    item.type !== "group" && item.groupId !== undefined && groupIdSet.has(item.groupId);

  // group 内の縦積み（親相対座標）と group サイズの確定
  const groupHeights = new Map<string, number>();
  for (const group of scene.items) {
    if (group.type !== "group") continue;
    const children = scene.items.filter((i) => isGroupedChild(i) && i.groupId === group.id);
    let y = GROUP_HEADER_HEIGHT;
    for (const child of children) {
      positions.set(child.id, { x: GROUP_PADDING_X, y });
      y += estimateItemHeight(child) + GROUP_CHILD_GAP;
    }
    const contentBottom = children.length > 0 ? y - GROUP_CHILD_GAP : y;
    const height = contentBottom + GROUP_PADDING_BOTTOM;
    sizes.set(group.id, { width: GROUP_WIDTH, height });
    groupHeights.set(group.id, height);
  }

  // トップレベル（group と、group に属さない item）を最短列に詰める
  const columnHeights = new Array<number>(COLUMNS).fill(0);
  for (const item of scene.items) {
    if (isGroupedChild(item)) continue;
    const height =
      item.type === "group" ? (groupHeights.get(item.id) ?? 0) : estimateItemHeight(item);
    let column = 0;
    for (let c = 1; c < COLUMNS; c += 1) {
      if (columnHeights[c] < columnHeights[column]) column = c;
    }
    positions.set(item.id, {
      x: column * (COLUMN_WIDTH + COLUMN_GAP),
      y: columnHeights[column],
    });
    columnHeights[column] += height + ROW_GAP;
  }

  return { positions, sizes };
}
