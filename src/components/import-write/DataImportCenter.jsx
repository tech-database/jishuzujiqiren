import { AnimatePresence } from "framer-motion";
import { Database, FileSpreadsheet, ShieldCheck } from "lucide-react";
import { PageHeader, StatusBadge } from "../design-system";
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
  setTargetTable,
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
      <PageHeader
        icon={<FileSpreadsheet size={24} />}
        title="数据导入与写入中心"
        description="选择 Excel 或 CSV 文件，提交到现有服务端解析与写入流程，并查看本次会话的真实处理结果。"
        actions={(
          <>
            <StatusBadge tone={configReady ? "success" : "warning"}>
              {configReady ? "配置已就绪" : "等待配置"}
            </StatusBadge>
            <StatusBadge tone="neutral">
              {IMPORT_FILE_EXTENSIONS.join(" / ")}
            </StatusBadge>
          </>
        )}
      />

      <section className="import-hero-panel">
        <div>
          <h2>数据导入与写入中心</h2>
          <p>
            当前接口一次性完成上传、解析、字段映射和写入；页面不模拟阶段进度，只展示真实可确认的处理状态。
          </p>
        </div>
        <div className="import-hero-meta">
          <span>
            <ShieldCheck size={17} />
            最大 {formatFileSize(IMPORT_FILE_MAX_BYTES)}
          </span>
          <span>
            <Database size={17} />
            目标表 {targetTable === "paint" ? "油漆" : "胶板"}
          </span>
        </div>
      </section>

      <section className="import-layout">
        <div className="import-main-column">
          <div className="import-target-row">
            <span>写入目标</span>
            {tableSelector}
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
            hasFiles={hasFiles}
            onClear={onClearFiles}
            onSubmit={onSubmit}
          />
        </div>

        <aside className="import-side-column">
          <ImportProcessSteps state={uploadState} hasFiles={hasFiles} />
          <section className="import-rule-card">
            <h2>写入规则</h2>
            <span>自动识别首个工作表</span>
            <span>使用当前字段映射</span>
            <span>表格内图片按后端能力处理</span>
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
