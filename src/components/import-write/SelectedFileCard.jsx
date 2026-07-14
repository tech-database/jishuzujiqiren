import { FileSpreadsheet, X } from "lucide-react";
import { motion } from "framer-motion";
import { getImportFileInfo, formatFileSize } from "../../utils/importFileUtils";

export default function SelectedFileCard({ file, disabled, onRemove }) {
  const info = getImportFileInfo(file);

  return (
    <motion.article
      className="import-file-card"
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
    >
      <FileSpreadsheet size={20} aria-hidden="true" />
      <div className="import-file-card-copy">
        <strong title={info.name}>{info.name}</strong>
        <span>
          {info.extension} · {formatFileSize(info.size)} · 修改于 {info.modifiedAt}
        </span>
        <small title={info.type}>{info.type}</small>
      </div>
      <button type="button" onClick={onRemove} disabled={disabled} aria-label={`移除 ${info.name}`}>
        <X size={16} />
      </button>
    </motion.article>
  );
}
