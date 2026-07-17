import { AnimatePresence } from "framer-motion";
import { HardDriveUpload } from "lucide-react";
import { PageTransition } from "../motion";
import { IMPORT_FILE_EXTENSIONS, IMPORT_FILE_MAX_BYTES, formatFileSize } from "../../utils/importFileUtils";
import FileDropZone from "./FileDropZone";
import ImportActionBar from "./ImportActionBar";
import ImportErrorPanel from "./ImportErrorPanel";
import ImportProcessSteps from "./ImportProcessSteps";
import ImportResultPanel from "./ImportResultPanel";
import SelectedFileCard from "./SelectedFileCard";

export default function DataImportCenter({
  files,
  dragging,
  uploading,
  uploadState,
  targetTable,
  tableSelector,
  configReady,
  fileInputRef,
  onDragStateChange,
  onFilesSelected,
  onRemoveFile,
  onClearFiles,
  onSubmit,
  onDismissError,
}) {
  const hasFiles = files.length > 0;

  return (
    <PageTransition className="import-center">
      <section className="import-layout">
        <div className="import-main-column">
          <div className="import-target-row">
            <span><HardDriveUpload size={17} />写入目标</span>
            {tableSelector}
            <small>支持 {IMPORT_FILE_EXTENSIONS.join(" / ")} · 最大 {formatFileSize(IMPORT_FILE_MAX_BYTES)}</small>
          </div>

          <FileDropZone
            fileInputRef={fileInputRef}
            dragging={dragging}
            disabled={uploading}
            onDragStateChange={onDragStateChange}
            onFilesSelected={onFilesSelected}
          />

          <AnimatePresence>
            {hasFiles && (
              <section className="import-file-list" aria-label="待写入文件">
                {files.map((file) => (
                  <SelectedFileCard
                    key={`${file.name}:${file.size}:${file.lastModified}`}
                    file={file}
                    disabled={uploading}
                    onRemove={() => onRemoveFile(file)}
                  />
                ))}
              </section>
            )}
          </AnimatePresence>

          <ImportActionBar
            disabled={uploading || !configReady || !hasFiles}
            uploading={uploading}
            files={files}
            onReselect={() => {
              onClearFiles();
              window.setTimeout(() => fileInputRef.current?.click(), 0);
            }}
            onSubmit={onSubmit}
          />
        </div>

        <aside className="import-side-column">
          <ImportProcessSteps state={uploadState} hasFiles={hasFiles} />
          <section className="import-rule-card">
            <h2>执行规则</h2>
            <span>目标：{targetTable === "paint" ? "油漆" : "胶板"}数据表</span>
            <span>自动读取首个工作表</span>
            <span>按当前字段映射写入</span>
          </section>
        </aside>
      </section>

      <ImportResultPanel state={uploadState} />
      <ImportErrorPanel
        state={uploadState}
        onRetry={onSubmit}
        onDismiss={onDismissError}
        disabled={uploading || !configReady || !hasFiles}
      />
    </PageTransition>
  );
}
