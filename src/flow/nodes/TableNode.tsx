import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { TableItem } from "../../types/scene";

export function TableNode(props: NodeProps) {
  const item = (props.data as { item: TableItem }).item;
  return (
    <div className="node table-node">
      <Handle type="target" position={Position.Left} className="handle" />
      {item.title && <div className="node-title">{item.title}</div>}
      <table>
        <thead>
          <tr>
            {item.columns.map((column, index) => (
              <th key={index}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {item.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {item.columns.map((_, colIndex) => (
                <td key={colIndex}>{row[colIndex] ?? ""}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <Handle type="source" position={Position.Right} className="handle" />
    </div>
  );
}
