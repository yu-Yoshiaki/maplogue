import { describe, expect, it } from "vitest";
import {
  normalizePinEntry,
  normalizePins,
  parseOrganizeMode,
  parsePinParentId,
  parseWorkspaceId,
} from "../../server/sceneApiPlugin";
import { toFlow } from "../flow/toFlow";
import { mergeNodePositions } from "../hooks/useScenePolling";
import type { Node } from "@xyflow/react";
import type { Pins, Scene } from "../types/scene";

const sceneWithGroup: Scene = {
  version: 1,
  title: "pin test",
  updatedAt: "2026-07-10T00:00:00.000Z",
  items: [
    { id: "group_001", type: "group", title: "G" },
    { id: "card_001", type: "card", title: "トップ" },
    { id: "card_002", type: "card", groupId: "group_001", title: "子" },
  ],
  edges: [],
};

describe("normalizePins", () => {
  it("旧形式 {x,y} を parentId:null に normalize する", () => {
    expect(normalizePinEntry({ x: 10, y: 20 })).toEqual({ x: 10, y: 20, parentId: null });
    expect(
      normalizePins({
        card_001: { x: 1, y: 2 },
        card_002: { x: 3, y: 4, parentId: "group_001" },
      }),
    ).toEqual({
      card_001: { x: 1, y: 2, parentId: null },
      card_002: { x: 3, y: 4, parentId: "group_001" },
    });
  });

  it("不正なエントリを落とす", () => {
    expect(normalizePins({ bad: { x: "a", y: 1 }, ok: { x: 1, y: 2 } })).toEqual({
      ok: { x: 1, y: 2, parentId: null },
    });
  });

  it("parsePinParentId は未指定を null、不正型を undefined にする", () => {
    expect(parsePinParentId(undefined)).toBe(null);
    expect(parsePinParentId(null)).toBe(null);
    expect(parsePinParentId("group_001")).toBe("group_001");
    expect(parsePinParentId(1)).toBeUndefined();
  });
});

describe("parseOrganizeMode", () => {
  it("未指定を normal にし、既知 mode だけ受け付ける", () => {
    expect(parseOrganizeMode(undefined)).toBe("normal");
    expect(parseOrganizeMode(null)).toBe("normal");
    expect(parseOrganizeMode("")).toBe("normal");
    expect(parseOrganizeMode("todo")).toBe("todo");
    expect(parseOrganizeMode("discussion")).toBe("discussion");
    expect(parseOrganizeMode("compare")).toBe("compare");
    expect(parseOrganizeMode("unknown")).toBeNull();
    expect(parseOrganizeMode(1)).toBeNull();
  });
});

describe("parseWorkspaceId", () => {
  it("未指定を default にし、安全な id だけ受け付ける", () => {
    expect(parseWorkspaceId(undefined)).toBe("default");
    expect(parseWorkspaceId(null)).toBe("default");
    expect(parseWorkspaceId("")).toBe("default");
    expect(parseWorkspaceId("default")).toBe("default");
    expect(parseWorkspaceId("ws_abc123")).toBe("ws_abc123");
    expect(parseWorkspaceId("../bad")).toBeNull();
    expect(parseWorkspaceId("bad/name")).toBeNull();
    expect(parseWorkspaceId("Bad")).toBeNull();
    expect(parseWorkspaceId(1)).toBeNull();
  });
});

describe("toFlow pin parentId", () => {
  it("parentId が一致する pin だけ適用する", () => {
    const pins: Pins = {
      card_001: { x: 111, y: 222, parentId: null },
      card_002: { x: 33, y: 44, parentId: "group_001" },
    };
    const { nodes } = toFlow(sceneWithGroup, pins);
    expect(nodes.find((n) => n.id === "card_001")?.position).toEqual({ x: 111, y: 222 });
    expect(nodes.find((n) => n.id === "card_002")?.position).toEqual({ x: 33, y: 44 });
  });

  it("旧形式相当 parentId:null の pin は group 子では無視する", () => {
    const pins: Pins = {
      card_002: { x: 999, y: 999, parentId: null },
    };
    const { nodes } = toFlow(sceneWithGroup, pins);
    const child = nodes.find((n) => n.id === "card_002");
    expect(child?.position).not.toEqual({ x: 999, y: 999 });
    expect(child?.parentId).toBe("group_001");
  });

  it("parentId が現在の所属と違う pin は無視する", () => {
    const pins: Pins = {
      card_001: { x: 50, y: 60, parentId: "group_001" },
    };
    const { nodes } = toFlow(sceneWithGroup, pins);
    expect(nodes.find((n) => n.id === "card_001")?.position).not.toEqual({ x: 50, y: 60 });
  });
});

describe("mergeNodePositions", () => {
  it("parentId が一致するときだけ旧 position を維持する", () => {
    const prev: Node[] = [
      { id: "card_001", position: { x: 10, y: 20 }, data: {}, parentId: undefined },
      { id: "card_002", position: { x: 100, y: 200 }, data: {}, parentId: undefined },
    ];
    const fresh: Node[] = [
      { id: "card_001", position: { x: 0, y: 0 }, data: {} },
      { id: "card_002", position: { x: 1, y: 2 }, data: {}, parentId: "group_001" },
    ];
    const merged = mergeNodePositions(prev, fresh, {});
    expect(merged.find((n) => n.id === "card_001")?.position).toEqual({ x: 10, y: 20 });
    // parentId が変わったので旧絶対座標は捨て、fresh を使う
    expect(merged.find((n) => n.id === "card_002")?.position).toEqual({ x: 1, y: 2 });
  });

  it("一致する pin があるときは fresh（pin 適用済み）を優先する", () => {
    const prev: Node[] = [{ id: "card_001", position: { x: 10, y: 20 }, data: {} }];
    const fresh: Node[] = [{ id: "card_001", position: { x: 77, y: 88 }, data: {} }];
    const pins: Pins = { card_001: { x: 77, y: 88, parentId: null } };
    const merged = mergeNodePositions(prev, fresh, pins);
    expect(merged[0].position).toEqual({ x: 77, y: 88 });
  });
});
