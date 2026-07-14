import { memo } from "react";
import { Trash2 } from "lucide-react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from "@xyflow/react";

function MappingEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  data,
}) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} className="field-mapping-edge-path" />
      <EdgeLabelRenderer>
        <button
          type="button"
          className="field-mapping-edge-action"
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          onClick={(event) => {
            event.stopPropagation();
            data?.onDelete?.(id);
          }}
          aria-label="删除映射"
          title="删除映射"
        >
          <Trash2 size={13} />
        </button>
      </EdgeLabelRenderer>
    </>
  );
}

export const MappingEdge = memo(MappingEdgeComponent);
