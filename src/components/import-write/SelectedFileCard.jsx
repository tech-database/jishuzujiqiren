import { useEffect, useState } from "react";
import { FileSpreadsheet, Loader2, X } from "lucide-react";
import { motion } from "framer-motion";
import { getImportFileInfo, formatFileSize } from "../../utils/importFileUtils";

export default function SelectedFileCard({ file, disabled, onRemove }) {
  const info = getImportFileInfo(file);
  const [preview, setPreview] = useState({ loading: true, sheets: null, rows: null, error: "" });

  useEffect(() => {
    let active = true;
    async function inspectFile() {
      try {
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const rows = workbook.SheetNames.reduce((total, name) => {
          const ref = workbook.Sheets[name]?.["!ref"];
          if (!ref) return total;
          const range = XLSX.utils.decode_range(ref);
          return total + Math.max(0, range.e.r - range.s.r);
        }, 0);
        if (active) setPreview({ loading: false, sheets: workbook.SheetNames.length, rows, error: "" });
      } catch {
        if (active) setPreview({ loading: false, sheets: null, rows: null, error: "预览解析失败" });
      }
    }
    inspectFile();
    return () => { active = false; };
  }, [file]);

  return (
    <motion.article className="import-file-card" layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
      <span className="import-file-type-icon"><FileSpreadsheet size={22} aria-hidden="true" /></span>
      <div className="import-file-card-copy">
        <strong title={info.name}>{info.name}</strong>
        <span>{info.extension.replace(".", "").toUpperCase()} 文件 · {formatFileSize(info.size)}</span>
      </div>
      <dl className="import-file-facts">
        <div><dt>工作表</dt><dd>{preview.loading ? "解析中" : preview.sheets ?? "—"}</dd></div>
        <div><dt>数据行</dt><dd>{preview.loading ? "解析中" : preview.rows ?? "—"}</dd></div>
        <div><dt>状态</dt><dd className={preview.error ? "error" : "ready"}>{preview.loading ? <><Loader2 size={12} />解析中</> : preview.error || "等待写入"}</dd></div>
      </dl>
      <button type="button" onClick={onRemove} disabled={disabled} aria-label={`移除 ${info.name}`}><X size={16} /></button>
    </motion.article>
  );
}
