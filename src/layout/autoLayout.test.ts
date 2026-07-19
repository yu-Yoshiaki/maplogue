import { describe, expect, it } from "vitest";
import type { Scene } from "../types/scene";
import { layoutScene } from "./autoLayout";

const baseScene: Scene = {
  version: 1,
  title: "レイアウトテスト",
  updatedAt: "2026-07-09T00:00:00.000Z",
  items: [
    { id: "card_001", type: "card", title: "カード1", body: "本文" },
    { id: "list_001", type: "list", title: "リスト", items: ["a", "b"] },
    { id: "group_001", type: "group", title: "グループ" },
    { id: "card_002", type: "card", groupId: "group_001", title: "子1" },
    { id: "card_003", type: "card", groupId: "group_001", title: "子2" },
  ],
  edges: [],
};

function positionsToObject(positions: Map<string, { x: number; y: number }>) {
  return Object.fromEntries(positions);
}

describe("layoutScene", () => {
  it("同一 scene で2回計算した結果が一致する（決定性）", () => {
    const first = layoutScene(baseScene);
    const second = layoutScene(baseScene);
    expect(positionsToObject(first.positions)).toEqual(positionsToObject(second.positions));
    expect(Object.fromEntries(first.sizes)).toEqual(Object.fromEntries(second.sizes));
  });

  it("既存 scene に item を追加しても既存 item の座標が変わらない（増分安定性）", () => {
    const before = layoutScene(baseScene);
    const extended: Scene = {
      ...baseScene,
      items: [
        ...baseScene.items,
        { id: "note_001", type: "note", text: "新規注意書き" },
      ],
    };
    const after = layoutScene(extended);

    for (const item of baseScene.items) {
      expect(after.positions.get(item.id)).toEqual(before.positions.get(item.id));
    }
    expect(after.positions.has("note_001")).toBe(true);
  });

  it("group 子が親相対座標で縦積みされ sizes が返る", () => {
    const result = layoutScene(baseScene);
    const child1 = result.positions.get("card_002");
    const child2 = result.positions.get("card_003");
    const groupSize = result.sizes.get("group_001");
    const groupPos = result.positions.get("group_001");

    expect(child1).toBeDefined();
    expect(child2).toBeDefined();
    expect(groupSize).toBeDefined();
    expect(groupPos).toBeDefined();

    // 親相対: x は GROUP_PADDING_X、y は縦に積まれる
    expect(child1!.x).toBe(16);
    expect(child2!.x).toBe(16);
    expect(child2!.y).toBeGreaterThan(child1!.y);

    // group の絶対座標はキャンバス上に配置される
    expect(groupPos!.x).toBeGreaterThanOrEqual(0);
    expect(groupSize!.width).toBeGreaterThan(0);
    expect(groupSize!.height).toBeGreaterThan(0);
  });
});
