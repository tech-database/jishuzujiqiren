import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "../design-system";
import { MappingCanvas } from "./MappingCanvas.jsx";
import { MappingLegend } from "./MappingLegend.jsx";
import { MappingToolbar } from "./MappingToolbar.jsx";
import {
  buildExcelFieldNames,
  fieldMappingsToEdges,
  findOrphanBackendMappings,
  normalizeFieldName,
} from "../../utils/fieldMappingTransform.js";

export default function MappingStudio({
  bitableFields,
  fieldMappings,
  backendFieldMap,
  onFieldMappingsChange,
  onSave,
  onLoadFields,
  saving,
  loading,
  configReady,
  saveState,
  checkState,
}) {
  const [customExcelFields, setCustomExcelFields] = useState([]);
  const [addExcelFieldValue, setAddExcelFieldValue] = useState("");
  const [dirty, setDirty] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [savedMappings, setSavedMappings] = useState(fieldMappings);
  const currentMappingsRef = useRef(fieldMappings);

  useEffect(() => {
    currentMappingsRef.current = fieldMappings;
    if (!dirty) setSavedMappings(fieldMappings);
  }, [dirty, fieldMappings]);

  const excelFields = useMemo(
    () => buildExcelFieldNames(bitableFields, fieldMappings, customExcelFields),
    [bitableFields, customExcelFields, fieldMappings],
  );

  const explicitEdges = useMemo(() => fieldMappingsToEdges(fieldMappings), [fieldMappings]);
  const orphanMappings = useMemo(
    () => findOrphanBackendMappings(backendFieldMap, bitableFields),
    [backendFieldMap, bitableFields],
  );

  const stats = useMemo(() => {
    const explicitCount = explicitEdges.length;
    const defaultCount = bitableFields.filter((field) => !normalizeFieldName(fieldMappings?.[field])).length;
    return {
      excelCount: excelFields.length,
      feishuCount: bitableFields.length,
      explicitCount,
      defaultCount,
    };
  }, [bitableFields, excelFields.length, explicitEdges.length, fieldMappings]);

  const handleMappingsChange = useCallback(
    (nextMappings) => {
      setDirty(true);
      onFieldMappingsChange(nextMappings);
    },
    [onFieldMappingsChange],
  );

  const handleAddExcelField = useCallback(
    (event) => {
      event.preventDefault();
      const name = normalizeFieldName(addExcelFieldValue);
      if (!name) return;
      if (excelFields.includes(name)) {
        setFeedback({ ok: false, text: "该 Excel 字段已经存在。" });
        return;
      }
      setCustomExcelFields((current) => [...current, name]);
      setAddExcelFieldValue("");
      setFeedback({ ok: true, text: "Excel 字段已添加，可拖拽创建映射。" });
    },
    [addExcelFieldValue, excelFields],
  );

  const handleSmartMatch = useCallback(() => {
    const excelSet = new Set(excelFields);
    const usedExcel = new Set(Object.values(fieldMappings || {}).map(normalizeFieldName).filter(Boolean));
    const next = { ...fieldMappings };
    let created = 0;

    for (const field of bitableFields) {
      if (normalizeFieldName(next[field])) continue;
      if (!excelSet.has(field) || usedExcel.has(field)) continue;
      next[field] = field;
      usedExcel.add(field);
      created += 1;
    }

    if (created === 0) {
      setFeedback({ ok: false, text: "没有可新增的同名字段匹配。" });
      return;
    }
    setDirty(true);
    onFieldMappingsChange(next);
    setFeedback({ ok: true, text: `智能匹配完成：新增 ${created} 条同名映射。` });
  }, [bitableFields, excelFields, fieldMappings, onFieldMappingsChange]);

  const handleReset = useCallback(() => {
    onFieldMappingsChange(savedMappings);
    setDirty(false);
    setFeedback({ ok: true, text: "未保存修改已重置。" });
  }, [onFieldMappingsChange, savedMappings]);

  const handleSave = useCallback(async () => {
    const ok = await onSave();
    if (ok) {
      setSavedMappings(currentMappingsRef.current);
      setDirty(false);
      setFeedback({ ok: true, text: "字段映射已保存。" });
    }
  }, [onSave]);

  const effectiveFeedback = feedback || saveState || checkState;

  return (
    <motion.section
      className="mapping-studio"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
    >
      <MappingToolbar
        stats={stats}
        addExcelFieldValue={addExcelFieldValue}
        onAddExcelFieldValueChange={setAddExcelFieldValue}
        onAddExcelField={handleAddExcelField}
        onSmartMatch={handleSmartMatch}
        onLoadFields={onLoadFields}
        onSave={handleSave}
        onReset={handleReset}
        saving={saving}
        dirty={dirty}
        disabled={loading || bitableFields.length === 0}
        loading={loading}
        configReady={configReady}
      />

      {effectiveFeedback && (
        <div className={`mapping-feedback ${effectiveFeedback.ok ? "ok" : "error"}`}>{effectiveFeedback.text}</div>
      )}

      {loading && (
        <GlassCard className="mapping-loading-state">
          <span />
          <span />
          <span />
        </GlassCard>
      )}

      {!loading && bitableFields.length === 0 && (
        <GlassCard className="mapping-empty-state">
          <strong>暂无飞书字段</strong>
          <p>请先完成连接配置，并点击“读取字段”从现有接口加载字段列表。</p>
        </GlassCard>
      )}

      {!loading && bitableFields.length > 0 && (
        <div className="mapping-workbench">
          <MappingCanvas
            bitableFields={bitableFields}
            fieldMappings={fieldMappings}
            customExcelFields={customExcelFields}
            onMappingsChange={handleMappingsChange}
            onFeedback={setFeedback}
            onSelectionDetailChange={setSelectedDetail}
          />
          <MappingLegend selectedDetail={selectedDetail} orphanMappings={orphanMappings} />
        </div>
      )}
    </motion.section>
  );
}
