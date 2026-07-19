import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { NoteItem } from "../../types/scene";

export function NoteNode(props: NodeProps) {
  const item = (props.data as { item: NoteItem }).item;
  const tone = item.tone ?? "info";
  return (
    <div className={`node note-node tone-${tone}`}>
      <Handle type="target" position={Position.Left} className="handle" />
      <div className="node-body">
        <span className="note-icon">{tone === "warning" ? "⚠️" : "💡"}</span>
        {item.text}
      </div>
      <Handle type="source" position={Position.Right} className="handle" />
    </div>
  );
}
