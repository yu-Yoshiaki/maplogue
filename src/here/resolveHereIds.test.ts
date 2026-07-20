import { describe, expect, it } from "vitest";
import { resolveHereEdgeIds, resolveHereItemIds } from "./resolveHereIds";
import type { HistoryBatch } from "../types/scene";

function batch(partial: Partial<HistoryBatch> & Pick<HistoryBatch, "id" | "changedItemIds">): HistoryBatch {
  return {
    inputIds: [],
    sceneVersionBefore: 1,
    sceneVersionAfter: 2,
    summary: "x",
    createdAt: "2026-07-20T00:00:00.000Z",
    ...partial,
  };
}

describe("resolveHereItemIds", () => {
  it("空なら空配列", () => {
    expect(resolveHereItemIds([])).toEqual([]);
  });

  it("末尾バッチの changedItemIds を返す", () => {
    const batches = [
      batch({ id: "batch_001", changedItemIds: ["card_001"] }),
      batch({ id: "batch_002", changedItemIds: ["card_002", "note_001"] }),
    ];
    expect(resolveHereItemIds(batches)).toEqual(["card_002", "note_001"]);
  });
});

describe("resolveHereEdgeIds", () => {
  it("端点が here に触れるエッジだけ返す", () => {
    const edges = [
      { id: "edge_001", source: "card_001", target: "card_002" },
      { id: "edge_002", source: "card_003", target: "card_004" },
    ];
    expect(resolveHereEdgeIds(edges, ["card_002"])).toEqual(["edge_001"]);
  });
});
