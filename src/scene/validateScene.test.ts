import { describe, expect, it } from "vitest";
import { validateScene } from "./validateScene";

const validScene = {
  version: 1,
  title: "テスト",
  updatedAt: "2026-07-09T00:00:00.000Z",
  items: [
    { id: "card_001", type: "card", title: "概要" },
    { id: "group_001", type: "group", title: "グループ" },
    { id: "card_002", type: "card", groupId: "group_001", title: "子" },
  ],
  edges: [{ id: "edge_001", source: "card_001", target: "card_002", label: "" }],
};

describe("validateScene", () => {
  it("妥当な scene が通る", () => {
    expect(validateScene(validScene)).toEqual([]);
  });

  it("初期 scene の空 updatedAt を許容する", () => {
    expect(validateScene({ ...validScene, updatedAt: "" })).toEqual([]);
  });

  it("orphan edge を検出する", () => {
    const scene = {
      ...validScene,
      edges: [{ id: "edge_001", source: "card_001", target: "card_999" }],
    };
    const errors = validateScene(scene);
    expect(errors.some((e) => e.includes("target") && e.includes("card_999"))).toBe(true);
  });

  it("存在しない groupId を検出する", () => {
    const scene = {
      ...validScene,
      items: [
        { id: "card_001", type: "card", title: "概要", groupId: "group_999" },
      ],
      edges: [],
    };
    const errors = validateScene(scene);
    expect(errors.some((e) => e.includes("group_999"))).toBe(true);
  });

  it("group 入れ子を検出する", () => {
    const scene = {
      ...validScene,
      items: [
        { id: "group_001", type: "group", title: "外側", groupId: "group_002" },
        { id: "group_002", type: "group", title: "内側" },
      ],
      edges: [],
    };
    const errors = validateScene(scene);
    expect(errors.some((e) => e.includes("groupId は付けられません"))).toBe(true);
  });

  it("型不正を検出する", () => {
    const scene = {
      ...validScene,
      items: [{ id: "card_001", type: "unknown", title: "不正" }],
    };
    const errors = validateScene(scene);
    expect(errors.some((e) => e.includes("type が不正"))).toBe(true);
  });

  it("不正な updatedAt を検出する", () => {
    const errors = validateScene({ ...validScene, updatedAt: "not-a-date" });
    expect(errors.some((e) => e.includes("updatedAt") && e.includes("ISO8601"))).toBe(true);
  });

  it("存在しない日付の updatedAt を検出する", () => {
    const errors = validateScene({ ...validScene, updatedAt: "2026-13-40T00:00:00.000Z" });
    expect(errors.some((e) => e.includes("updatedAt") && e.includes("ISO8601"))).toBe(true);
  });

  it("暦外日の updatedAt（2月30日）を検出する", () => {
    // Date.parse は 2026-02-30 を 3/2 に正規化して通すことがあるため、暦日検証が必要
    const errors = validateScene({ ...validScene, updatedAt: "2026-02-30T00:00:00.000Z" });
    expect(errors.some((e) => e.includes("updatedAt") && e.includes("ISO8601"))).toBe(true);
  });

  it("範囲外の時分秒・オフセットの updatedAt を検出する", () => {
    expect(
      validateScene({ ...validScene, updatedAt: "2026-07-09T24:00:00.000Z" }).some(
        (e) => e.includes("updatedAt") && e.includes("ISO8601"),
      ),
    ).toBe(true);
    expect(
      validateScene({ ...validScene, updatedAt: "2026-07-09T12:60:00.000Z" }).some(
        (e) => e.includes("updatedAt") && e.includes("ISO8601"),
      ),
    ).toBe(true);
    expect(
      validateScene({ ...validScene, updatedAt: "2026-07-09T12:00:60.000Z" }).some(
        (e) => e.includes("updatedAt") && e.includes("ISO8601"),
      ),
    ).toBe(true);
    expect(
      validateScene({ ...validScene, updatedAt: "2026-07-09T12:00:00.000+24:00" }).some(
        (e) => e.includes("updatedAt") && e.includes("ISO8601"),
      ),
    ).toBe(true);
  });

  it("オフセット付きの妥当な updatedAt を許容する", () => {
    expect(validateScene({ ...validScene, updatedAt: "2026-07-09T12:00:00+09:00" })).toEqual([]);
  });

  it("table row の列数不一致を検出する", () => {
    const scene = {
      ...validScene,
      items: [
        {
          id: "table_001",
          type: "table",
          columns: ["A", "B"],
          rows: [
            ["1", "2"],
            ["3"],
          ],
        },
      ],
      edges: [],
    };
    const errors = validateScene(scene);
    expect(errors.some((e) => e.includes("rows[1]") && e.includes("columns.length"))).toBe(true);
  });

  it("item id の type prefix 不一致を検出する", () => {
    const scene = {
      ...validScene,
      items: [{ id: "note_001", type: "card", title: "不一致" }],
      edges: [],
    };
    const errors = validateScene(scene);
    expect(errors.some((e) => e.includes("id は") && e.includes("card_"))).toBe(true);
  });

  it("桁不足の item id を検出する", () => {
    const scene = {
      ...validScene,
      items: [{ id: "card_01", type: "card", title: "桁不足" }],
      edges: [],
    };
    const errors = validateScene(scene);
    expect(errors.some((e) => e.includes("3桁以上"))).toBe(true);
  });

  it("不正な edge id を検出する", () => {
    const scene = {
      ...validScene,
      edges: [{ id: "e_001", source: "card_001", target: "card_002" }],
    };
    const errors = validateScene(scene);
    expect(errors.some((e) => e.includes("edge_") && e.includes("3桁以上"))).toBe(true);
  });
});
