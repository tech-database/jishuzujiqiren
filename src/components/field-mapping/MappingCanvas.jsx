import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  addEdge,
  applyEdgeChanges,
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ExcelFieldNode } from "./ExcelFieldNode.jsx";
import { FeishuFieldNode } from "./FeishuFieldNode.jsx";
import { MappingEdge } from "./MappingEdge.jsx";
import {
  buildMappingNodes,
  edgesToFieldMappings,
  FIELD_NODE_SIDE,
  fieldMappingsToEdges,
  parseFieldNodeId,
} from "../../utils/fieldMappingTransform.js";

const nodeTypes = {
  excelField: ExcelFieldNode,
  feishuField: FeishuFieldNode,
};

const edgeTypes = {
  mapping: MappingEdge,
};

function validateConnection(connection, edges) {
  const source = parseFieldNodeId(connection.source);
  const target = parseFieldNodeId(connection.target);

  if (source.side !== FIELD_NODE_SIDE.excel) {
    return "来源必须是 Excel 字段。";
  }
  if (target.side !== FIELD_NODE_SIDE.feishu) {
    return "目标必须是飞书字段。";
  }
  if (edges.some((edge) => edge.source === connection.source && edge.target === connection.target)) {
    return "这组字段已经存在映射。";
  }
  if (edges.some((edge) => edge.source === connection.source)) {
    return "当前 Excel 字段已经绑定到其他飞书字段。";
  }
  if (edges.some((edge) => edge.target === connection.target)) {
    return "当前飞书字段已经有来源字段。";
  }
  return "";
}

export function MappingCanvas({
  bitableFields,
  fieldMappings,
  customExcelFields,
  onMappingsChange,
  onFeedback,
  onSelectionDetailChange,
}) {
  const nodePositionsRef = useRef(new Map());
  const initialNodes = useMemo(
    () =>
      buildMappingNodes({
        bitableFields,
        fieldMappings,
        customExcelFields,
        existingPositions: nodePositionsRef.current,
      }),
    [bitableFields, customExcelFields, fieldMappings],
  );
  const initialEdges = useMemo(() => fieldMappingsToEdges(fieldMappings), [fieldMappings]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges] = useEdgesState(initialEdges);

  const syncMappingsFromEdges = useCallback(
    (nextEdges) => {
      onMappingsChange(edgesToFieldMappings(nextEdges, bitableFields));
    },
    [bitableFields, onMappingsChange],
  );

  const deleteEdge = useCallback(
    (edgeId) => {
      setEdges((current) => {
        const next = current.filter((edge) => edge.id !== edgeId);
        syncMappingsFromEdges(next);
        onFeedback({ ok: true, text: "映射已删除，保存后生效。" });
        return next;
      });
    },
    [onFeedback, setEdges, syncMappingsFromEdges],
  );

  useEffect(() => {
    setNodes((current) => {
      nodePositionsRef.current = new Map(current.map((node) => [node.id, node.position]));
      return buildMappingNodes({
        bitableFields,
        fieldMappings,
        customExcelFields,
        existingPositions: nodePositionsRef.current,
      });
    });
  }, [bitableFields, customExcelFields, fieldMappings, setNodes]);

  useEffect(() => {
    setEdges(
      fieldMappingsToEdges(fieldMappings).map((edge) => ({
        ...edge,
        markerEnd: { type: MarkerType.ArrowClosed },
        data: { ...edge.data, onDelete: deleteEdge },
      })),
    );
  }, [deleteEdge, fieldMappings, setEdges]);

  const handleEdgesChange = useCallback(
    (changes) => {
      setEdges((current) => {
        const next = applyEdgeChanges(changes, current);
        if (changes.some((change) => change.type === "remove")) {
          syncMappingsFromEdges(next);
          onFeedback({ ok: true, text: "映射已删除，保存后生效。" });
        }
        return next;
      });
    },
    [onFeedback, setEdges, syncMappingsFromEdges],
  );

  const handleConnect = useCallback(
    (connection) => {
      setEdges((current) => {
        const error = validateConnection(connection, current);
        if (error) {
          onFeedback({ ok: false, text: error });
          return current;
        }

        const source = parseFieldNodeId(connection.source);
        const target = parseFieldNodeId(connection.target);
        const nextEdge = {
          ...connection,
          id: `mapping:${connection.source}->${connection.target}`,
          type: "mapping",
          markerEnd: { type: MarkerType.ArrowClosed },
          data: {
            sourceName: source.name,
            targetName: target.name,
            onDelete: deleteEdge,
          },
        };
        const next = addEdge(nextEdge, current);
        syncMappingsFromEdges(next);
        onFeedback({ ok: true, text: "映射已创建，保存后生效。" });
        return next;
      });
    },
    [deleteEdge, onFeedback, setEdges, syncMappingsFromEdges],
  );

  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }) => {
      const node = selectedNodes?.[0];
      const edge = selectedEdges?.[0];
      if (node) {
        onSelectionDetailChange({
          title: node.data.name,
          description: node.type === "excelField" ? "Excel 来源字段" : "飞书目标字段",
        });
        return;
      }
      if (edge) {
        onSelectionDetailChange({
          title: edge.data?.targetName || "字段映射",
          description: `${edge.data?.sourceName || ""} -> ${edge.data?.targetName || ""}`,
        });
        return;
      }
      onSelectionDetailChange(null);
    },
    [onSelectionDetailChange],
  );

  return (
    <div className="mapping-canvas-shell">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onSelectionChange={handleSelectionChange}
        fitView
        minZoom={0.35}
        maxZoom={1.6}
        deleteKeyCode={["Backspace", "Delete"]}
      >
        <Background gap={24} size={1.2} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable nodeStrokeWidth={3} className="mapping-minimap" />
      </ReactFlow>
    </div>
  );
}
