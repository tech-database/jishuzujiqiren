import { useMemo, useRef, useState } from "react";
import {
  getImportFileKey,
  validateImportFiles,
} from "../../utils/importFileUtils.js";
import {
  commitQuoteStatistics,
  previewQuoteStatistics,
} from "./quote-statistics.api.js";

export const QUOTE_BATCH_FILE_LIMIT = 50;

function localDate() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

export const quoteOfficerOptions = Object.freeze([
  { name: "杨利伟", category: "胶板" },
  { name: "邓翠萍", category: "胶板" },
  { name: "朱海韵", category: "油漆" },
  { name: "胡燕琪", category: "软体" },
]);

export function assertSingleQuoteWrite(result) {
  const count = Number(result?.count);
  if (count === 1) return;
  throw new Error(
    `写入结果异常：应创建 1 条记录，实际创建 ${Number.isFinite(count) ? count : 0} 条。`,
  );
}

function newPreviewRow(file) {
  return {
    key: getImportFileKey(file),
    file,
    fileName: file.name,
    status: "pending",
    error: "",
  };
}

export function getUnreadQuoteFiles(files, previewRows) {
  const previewByKey = new Map(
    previewRows.map((row) => [row.key, row]),
  );
  return files.filter((file) => {
    const existing = previewByKey.get(getImportFileKey(file));
    return !existing || existing.status === "preview_error";
  });
}

export function mergeQuotePreviewRows(currentRows, queuedRows) {
  const queuedByKey = new Map(queuedRows.map((row) => [row.key, row]));
  const merged = currentRows.map((row) => queuedByKey.get(row.key) || row);
  const currentKeys = new Set(currentRows.map((row) => row.key));
  return [
    ...merged,
    ...queuedRows.filter((row) => !currentKeys.has(row.key)),
  ];
}

export function useQuoteStatisticsController() {
  const fileInputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [quoteOfficer, setQuoteOfficer] = useState("");
  const [quoteDate, setQuoteDate] = useState(localDate);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewRows, setPreviewRows] = useState([]);
  const [feedback, setFeedback] = useState(null);

  const readyCount = useMemo(
    () => previewRows.filter((row) => row.status === "ready" || row.status === "write_error").length,
    [previewRows],
  );
  const writtenCount = useMemo(
    () => previewRows.filter((row) => row.status === "written").length,
    [previewRows],
  );
  const unreadFiles = useMemo(
    () => getUnreadQuoteFiles(files, previewRows),
    [files, previewRows],
  );

  function resetPreview() {
    setPreviewRows([]);
    setFeedback(null);
  }

  function selectFiles(incomingFiles) {
    const incoming = Array.from(incomingFiles || []);
    const { validFiles, errors } = validateImportFiles(incoming);
    const existingKeys = new Set([
      ...files.map(getImportFileKey),
      ...previewRows.map((row) => row.key),
    ]);
    const uniqueFiles = validFiles.filter((file) => !existingKeys.has(getImportFileKey(file)));
    const duplicateCount = validFiles.length - uniqueFiles.length;
    const availableSlots = Math.max(0, QUOTE_BATCH_FILE_LIMIT - files.length);
    const accepted = uniqueFiles.slice(0, availableSlots);
    const overflowCount = uniqueFiles.length - accepted.length;

    if (accepted.length > 0) {
      setFiles((current) => [...current, ...accepted]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";

    const messages = errors.map((error) => `${error.fileName}：${error.message}`);
    if (overflowCount > 0) {
      messages.push(`单次最多处理 ${QUOTE_BATCH_FILE_LIMIT} 份清单，已忽略 ${overflowCount} 份。`);
    }
    if (duplicateCount > 0) {
      messages.push(`已跳过 ${duplicateCount} 份重复或已读取清单。`);
    }
    setFeedback(
      messages.length > 0
        ? { ok: false, text: messages.join("；") }
        : accepted.length > 0
          ? { ok: null, text: `已选择 ${files.length + accepted.length} 份清单。` }
          : feedback,
    );
  }

  function removeFile(fileToRemove) {
    const fileKey = getImportFileKey(fileToRemove);
    setFiles((current) => current.filter((file) => file !== fileToRemove));
    setPreviewRows((current) => current.filter((row) => row.key !== fileKey));
  }

  function clearFiles() {
    setFiles([]);
    setPreviewRows([]);
    setFeedback(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function updateQuoteOfficer(value) {
    setQuoteOfficer(value);
    resetPreview();
  }

  function updateQuoteDate(value) {
    setQuoteDate(value);
    resetPreview();
  }

  async function previewFiles() {
    if (files.length === 0) {
      setFeedback({ ok: false, text: "请先选择报价清单。" });
      return;
    }
    if (!quoteOfficer) {
      setFeedback({ ok: false, text: "请先选择报价员。" });
      return;
    }

    const rows = unreadFiles.map(newPreviewRow);
    if (rows.length === 0) {
      setFeedback({ ok: true, text: "当前清单均已读取，没有需要重复处理的文件。" });
      return;
    }

    setBusy(true);
    setPreviewRows((current) => mergeQuotePreviewRows(current, rows));
    let successCount = 0;
    let failedCount = 0;

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      setFeedback({
        ok: null,
        text: `正在统计 ${index + 1}/${rows.length}：${row.fileName}`,
      });
      setPreviewRows((current) =>
        current.map((item) => item.key === row.key ? { ...item, status: "reading" } : item));
      try {
        const data = await previewQuoteStatistics(row.file, quoteOfficer, quoteDate);
        successCount += 1;
        setPreviewRows((current) =>
          current.map((item) => item.key === row.key
            ? {
                ...item,
                ...data.summary,
                fileName: data.fileName,
                sourceRowCount: data.sourceRowCount,
                ignoredUnpricedRowCount: data.ignoredUnpricedRowCount || 0,
                ignoredInvalidRowCount: data.ignoredInvalidRowCount || 0,
                warnings: data.warnings || [],
                status: "ready",
              }
            : item));
      } catch (error) {
        failedCount += 1;
        setPreviewRows((current) =>
          current.map((item) => item.key === row.key
            ? { ...item, status: "preview_error", error: error.message || "统计失败" }
            : item));
      }
    }

    setFeedback({
      ok: failedCount === 0,
      text: failedCount === 0
        ? `已完成 ${successCount} 份清单统计，请核对后批量写入。`
        : `统计完成：成功 ${successCount} 份，失败 ${failedCount} 份。`,
    });
    setBusy(false);
  }

  async function commitPreviews() {
    const rowsToCommit = previewRows.filter(
      (row) => row.status === "ready" || row.status === "write_error",
    );
    if (rowsToCommit.length === 0) return;

    setBusy(true);
    let successCount = 0;
    let failedCount = 0;
    for (let index = 0; index < rowsToCommit.length; index += 1) {
      const row = rowsToCommit[index];
      setFeedback({
        ok: null,
        text: `正在写入 ${index + 1}/${rowsToCommit.length}：${row.fileName}`,
      });
      setPreviewRows((current) =>
        current.map((item) => item.key === row.key ? { ...item, status: "writing", error: "" } : item));
      try {
        const result = await commitQuoteStatistics(row.file, quoteOfficer, quoteDate);
        assertSingleQuoteWrite(result);
        successCount += 1;
        setPreviewRows((current) =>
          current.map((item) => item.key === row.key ? { ...item, status: "written" } : item));
      } catch (error) {
        failedCount += 1;
        setPreviewRows((current) =>
          current.map((item) => item.key === row.key
            ? { ...item, status: "write_error", error: error.message || "写入失败" }
            : item));
      }
    }
    setFeedback({
      ok: failedCount === 0,
      text: failedCount === 0
        ? `已成功写入 ${successCount} 条报价统计记录。`
        : `写入完成：成功 ${successCount} 条，失败 ${failedCount} 条，可重试失败项。`,
    });
    setBusy(false);
  }

  return {
    busy,
    clearFiles,
    commitPreviews,
    dragging,
    feedback,
    fileInputRef,
    files,
    previewFiles,
    previewRows,
    quoteOfficer,
    quoteDate,
    readyCount,
    removeFile,
    selectFiles,
    setDragging,
    updateQuoteOfficer,
    updateQuoteDate,
    unreadCount: unreadFiles.length,
    writtenCount,
  };
}
