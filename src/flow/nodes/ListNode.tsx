import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { ListItem } from "../../types/scene";

export function ListNode(props: NodeProps) {
  const item = (props.data as { item: ListItem }).item;
  return (
    <div className="node list-node">
      <Handle type="target" position={Position.Left} className="handle" />
      {item.title && <div className="node-title">{item.title}</div>}
      <ul className="list-items">
        {item.items.map((text, index) => (
          <li key={index}>{text}</li>
        ))}
      </ul>
      <Handle type="source" position={Position.Right} className="handle" />
    </div>
  );
}
