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
        if (info.extension === ".xls") {
          if (active) setPreview({ loading: false, sheets: null, rows: null, error: "" });
          return;
        }
        if (info.extension === ".csv") {
          const text = await file.text();
          const rows = text.split(/\r?\n/).filter((line) => line.trim()).length;
          if (active) setPreview({ loading: false, sheets: 1, rows: Math.max(0, rows - 1), error: "" });
          return;
        }

        const JSZip = (await import("jszip")).default;
        const zip = await JSZip.loadAsync(await file.arrayBuffer());
        const entries = Object.values(zip.files);
        const uncompressedBytes = entries.reduce(
          (total, entry) => total + Number(entry?._data?.uncompressedSize || 0),
          0,
        );
        if (entries.length > 5000 || uncompressedBytes > 512 * 1024 * 1024) {
          throw new Error("文件解压后体积异常");
        }
        const worksheetEntries = entries.filter((entry) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(entry.name));
        let rows = 0;
        for (const entry of worksheetEntries) {
          const xml = await entry.async("string");
          rows += Math.max(0, (xml.match(/<row\b/g) || []).length - 1);
        }
        if (active) setPreview({ loading: false, sheets: worksheetEntries.length, rows, error: "" });
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
