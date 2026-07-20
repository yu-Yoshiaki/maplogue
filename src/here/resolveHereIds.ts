import type { HistoryBatch } from "../types/scene";

/**
 * 直近バッチで変更された item id を「いまここ」として返す。
 * batches は history.json の時系列順（末尾が最新）を想定する。
 */
export function resolveHereItemIds(batches: HistoryBatch[]): string[] {
  if (batches.length === 0) return [];
  const latest = batches[batches.length - 1];
  return latest.changedItemIds.filter((id) => typeof id === "string" && id.length > 0);
}

/** 端点のどちらかが「いまここ」に含まれるエッジを強調対象にする */
export function resolveHereEdgeIds(
  edges: Array<{ id: string; source: string; target: string }>,
  hereItemIds: ReadonlySet<string> | readonly string[],
): string[] {
  const here = hereItemIds instanceof Set ? hereItemIds : new Set(hereItemIds);
  if (here.size === 0) return [];
  return edges.filter((edge) => here.has(edge.source) || here.has(edge.target)).map((edge) => edge.id);
}
