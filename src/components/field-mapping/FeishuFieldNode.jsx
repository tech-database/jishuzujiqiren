import { memo } from "react";
import { Database, Link2 } from "lucide-react";
import { Handle, Position } from "@xyflow/react";

function FeishuFieldNodeComponent({ data, selected }) {
  return (
    <div className={`field-flow-node feishu ${selected ? "selected" : ""} ${data.mapped ? "mapped" : ""}`}>
      <Handle id="feishu-input" type="target" position={Position.Left} className="field-flow-handle input" />
      <div className="field-flow-node-icon">
        <Database size={18} />
      </div>
      <div className="field-flow-node-copy">
        <strong title={data.name}>{data.name}</strong>
        <span>{data.typeLabel}</span>
        <small>{data.mappedFrom ? `来自 ${data.mappedFrom}` : data.sourceLabel}</small>
      </div>
      <div className="field-flow-node-state">
        <Link2 size={14} />
        {data.mapped ? "已绑定" : "待绑定"}
      </div>
    </div>
  );
}

export const FeishuFieldNode = memo(FeishuFieldNodeComponent);
