import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { CardItem } from "../../types/scene";

export function CardNode(props: NodeProps) {
  const item = (props.data as { item: CardItem }).item;
  return (
    <div className="node card-node">
      <Handle type="target" position={Position.Left} className="handle" />
      <div className="node-title">{item.title}</div>
      {item.body && <div className="node-body">{item.body}</div>}
      <Handle type="source" position={Position.Right} className="handle" />
    </div>
  );
}
