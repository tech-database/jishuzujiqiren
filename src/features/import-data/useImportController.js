import { useRef, useState } from "react";
import { getImportFileKey, validateImportFiles } from "../../utils/importFileUtils.js";
import { buildImportSuccessText, sanitizeImportError } from "../../utils/importResultUtils.js";
import { uploadSpreadsheet } from "./import.api.js";

export function useImportController(targetTable) {
  const fileInputRef = useRef(null);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [draggingUpload, setDraggingUpload] = useState(false);
  const [uploadState, setUploadState] = useState(null);

  function addUploadFiles(files) {
    const incoming = Array.from(files || []);
    if (incoming.length === 0) return;
    const { validFiles, errors } = validateImportFiles(incoming);
    if (errors.length > 0) {
      setUploadState({
        ok: false,
        phase: "validation",
        text: errors.map((error) => `${error.fileName}: ${error.message}`).join("；"),
        errors,
      });
    }
    if (validFiles.length === 0) return;

    setUploadFiles((current) => {
      const existing = new Set(current.map(getImportFileKey));
      return [...current, ...validFiles.filter((file) => !existing.has(getImportFileKey(file)))];
    });
    if (errors.length === 0) setUploadState(null);
  }

  function removeUploadFile(fileToRemove) {
    setUploadFiles((current) => current.filter((file) => file !== fileToRemove));
  }

  function clearUploadFiles() {
    setUploadFiles([]);
    setUploadState(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function uploadSpreadsheets() {
    if (uploadFiles.length === 0) {
      setUploadState({ ok: false, phase: "select", text: "请先拖入或选择 Excel / CSV 文件" });
      return;
    }
    const { errors } = validateImportFiles(uploadFiles);
    if (errors.length > 0) {
      setUploadState({
        ok: false,
        phase: "validation",
        text: errors.map((error) => `${error.fileName}: ${error.message}`).join("；"),
        errors,
      });
      return;
    }

    setUploading(true);
    setUploadState({ ok: null, phase: "submit", text: "正在提交文件" });
    const results = [];
    try {
      for (let index = 0; index < uploadFiles.length; index += 1) {
        const file = uploadFiles[index];
        setUploadState({
          ok: null,
          phase: "server",
          text: `服务端处理中 ${index + 1}/${uploadFiles.length}：${file.name}`,
          fileName: file.name,
        });
        const data = await uploadSpreadsheet(file, targetTable);
        if (!data.ok) throw new Error(`${file.name}: ${data.error || "服务端处理失败"}`);
        results.push(data);
      }
      setUploadState({
        ok: true,
        phase: "complete",
        text: buildImportSuccessText(results),
        results,
      });
      setUploadFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      setUploadState({
        ok: false,
        phase: error.phase || "server",
        text: sanitizeImportError(error),
        fileName: error.fileName,
        status: error.status,
      });
    } finally {
      setUploading(false);
    }
  }

  return {
    addUploadFiles,
    clearUploadFiles,
    draggingUpload,
    fileInputRef,
    removeUploadFile,
    setDraggingUpload,
    setUploadState,
    uploadFiles,
    uploading,
    uploadSpreadsheets,
    uploadState,
  };
}
