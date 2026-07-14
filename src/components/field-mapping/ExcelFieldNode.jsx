import { memo } from "react";
import { FileSpreadsheet, Link2 } from "lucide-react";
import { Handle, Position } from "@xyflow/react";

function ExcelFieldNodeComponent({ data, selected }) {
  return (
    <div className={`field-flow-node excel ${selected ? "selected" : ""} ${data.mapped ? "mapped" : ""}`}>
      <div className="field-flow-node-icon">
        <FileSpreadsheet size={18} />
      </div>
      <div className="field-flow-node-copy">
        <strong title={data.name}>{data.name}</strong>
        <span>{data.typeLabel}</span>
        <small>{data.sourceLabel}</small>
      </div>
      <div className="field-flow-node-state">
        <Link2 size={14} />
        {data.mapped ? "已映射" : "可连接"}
      </div>
      <Handle id="excel-output" type="source" position={Position.Right} className="field-flow-handle output" />
    </div>
  );
}

export const ExcelFieldNode = memo(ExcelFieldNodeComponent);
