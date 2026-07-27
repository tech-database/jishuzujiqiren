import DataImportCenter from "../../components/import-write/DataImportCenter.jsx";
import { TableSelector } from "../../shared/components/TableSelector.jsx";

export default function ImportPage({
  configReady,
  controller: c,
  setTargetTable,
  targetTable,
}) {
  return (
    <DataImportCenter
      files={c.uploadFiles}
      dragging={c.draggingUpload}
      uploading={c.uploading}
      uploadState={c.uploadState}
      targetTable={targetTable}
      setTargetTable={setTargetTable}
      tableSelector={<TableSelector value={targetTable} onChange={setTargetTable} />}
      configReady={configReady}
      fileInputRef={c.fileInputRef}
      onDragStateChange={c.setDraggingUpload}
      onFilesSelected={c.addUploadFiles}
      onRemoveFile={c.removeUploadFile}
      onClearFiles={c.clearUploadFiles}
      onSubmit={c.uploadSpreadsheets}
      onDismissError={() => c.setUploadState(null)}
    />
  );
}
