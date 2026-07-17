import { FileSpreadsheet, UploadCloud } from "lucide-react";
import { IMPORT_FILE_ACCEPT, IMPORT_FILE_MAX_BYTES, formatFileSize } from "../../utils/importFileUtils";

export default function FileDropZone({
  fileInputRef,
  dragging,
  disabled,
  onDragStateChange,
  onFilesSelected,
}) {
  const handleDrop = (event) => {
    event.preventDefault();
    onDragStateChange(false);
    onFilesSelected(event.dataTransfer.files);
  };

  return (
    <section
      className={`import-dropzone ${dragging ? "dragging" : ""}`}
      onDragEnter={(event) => {
        event.preventDefault();
        if (!disabled) onDragStateChange(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        event.preventDefault();
        onDragStateChange(false);
      }}
      onDrop={disabled ? undefined : handleDrop}
      aria-label="选择或拖拽导入文件"
    >
      <div className="import-dropzone-icon" aria-hidden="true">
        <UploadCloud size={32} />
      </div>
      <div>
        <h2>{dragging ? "松开即可添加文件" : "拖拽文件到这里"}</h2>
        <p>支持 Excel / CSV · 单个文件最大 {formatFileSize(IMPORT_FILE_MAX_BYTES)}</p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={IMPORT_FILE_ACCEPT}
        multiple
        disabled={disabled}
        onChange={(event) => onFilesSelected(event.target.files)}
        aria-label="选择 Excel 或 CSV 文件"
      />
      <button type="button" onClick={() => fileInputRef.current?.click()} disabled={disabled}>
        <FileSpreadsheet size={18} />
        浏览文件
      </button>
    </section>
  );
}
