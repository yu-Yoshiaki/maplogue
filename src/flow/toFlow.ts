// Scene → React Flow の nodes/edges 変換。
// 座標の優先順位: pins（ユーザー固定） > autoLayout。
// 増分反映（既存ノードの位置維持）は useScenePolling 側で行う。

import { MarkerType, type Edge, type Node } from "@xyflow/react";
import { layoutScene } from "../layout/autoLayout";
import type { Pins, Scene } from "../types/scene";

export function toFlow(scene: Scene, pins: Pins): { nodes: Node[]; edges: Edge[] } {
  const { positions, sizes } = layoutScene(scene);
  const groupIdSet = new Set(scene.items.filter((i) => i.type === "group").map((i) => i.id));

  // React Flow は親ノードが子より先に並んでいる必要がある
  const ordered = [
    ...scene.items.filter((i) => i.type === "group"),
    ...scene.items.filter((i) => i.type !== "group"),
  ];

  const nodes: Node[] = ordered.map((item) => {
    const grouped =
      item.type !== "group" && item.groupId !== undefined && groupIdSet.has(item.groupId);
    const parentId = grouped ? (item.groupId as string) : null;
    const size = sizes.get(item.id);
    const pin = pins[item.id];
    // pin の座標系（parentId）が現在の所属と一致するときだけ適用する
    const usePin = pin !== undefined && pin.parentId === parentId;
    return {
      id: item.id,
      type: item.type,
      position: usePin
        ? { x: pin.x, y: pin.y }
        : (positions.get(item.id) ?? { x: 0, y: 0 }),
      data: { item },
      ...(grouped ? { parentId: item.groupId, extent: "parent" as const } : {}),
      ...(size ? { style: { width: size.width, height: size.height } } : {}),
    };
  });

  const itemIds = new Set(scene.items.map((i) => i.id));
  const edges: Edge[] = scene.edges
    .filter((e) => itemIds.has(e.source) && itemIds.has(e.target))
    .map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      type: "smoothstep",
      markerEnd: { type: MarkerType.ArrowClosed },
    }));

  return { nodes, edges };
}
