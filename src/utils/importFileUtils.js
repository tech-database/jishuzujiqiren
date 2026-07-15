export const IMPORT_FILE_EXTENSIONS = [".xlsx", ".xls", ".csv"];
export const IMPORT_FILE_ACCEPT = IMPORT_FILE_EXTENSIONS.join(",");
export const IMPORT_FILE_MAX_BYTES = 50 * 1024 * 1024;

function getFileExtension(fileName = "") {
  const match = String(fileName).toLowerCase().match(/\.[^.]+$/);
  return match ? match[0] : "";
}

function isSupportedImportFile(file) {
  return IMPORT_FILE_EXTENSIONS.includes(getFileExtension(file?.name));
}

export function getImportFileKey(file) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export function formatFileSize(size = 0) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatFileModifiedTime(value) {
  if (!value) return "未知";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未知";
  return date.toLocaleString("zh-CN", { hour12: false });
}

export function getImportFileInfo(file) {
  return {
    name: file?.name || "未命名文件",
    size: file?.size || 0,
    extension: getFileExtension(file?.name) || "未知",
    type: file?.type || "浏览器未提供 MIME",
    modifiedAt: formatFileModifiedTime(file?.lastModified),
  };
}

export function validateImportFiles(files = []) {
  const errors = [];
  const validFiles = [];

  for (const file of Array.from(files || [])) {
    if (!file) continue;
    if (!isSupportedImportFile(file)) {
      errors.push({
        fileName: file.name || "未知文件",
        message: "文件格式不受支持，仅支持 .xlsx、.xls、.csv",
      });
      continue;
    }
    if (file.size === 0) {
      errors.push({
        fileName: file.name,
        message: "文件为空",
      });
      continue;
    }
    if (file.size > IMPORT_FILE_MAX_BYTES) {
      errors.push({
        fileName: file.name,
        message: `文件超过 ${formatFileSize(IMPORT_FILE_MAX_BYTES)} 限制`,
      });
      continue;
    }
    validFiles.push(file);
  }

  return { validFiles, errors };
}
