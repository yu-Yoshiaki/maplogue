import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { GroupItem } from "../../types/scene";

export function GroupNode(props: NodeProps) {
  const item = (props.data as { item: GroupItem }).item;
  return (
    <div className="group-node">
      <Handle type="target" position={Position.Left} className="handle" />
      <div className="group-title">{item.title}</div>
      <Handle type="source" position={Position.Right} className="handle" />
    </div>
  );
}
