import { postBinary, postJson } from "../../shared/api/client.js";

async function sendQuoteFile(path, file, quoteOfficer, quoteDate, entryType = "报价") {
  const query = new URLSearchParams({
    fileName: file.name,
    quoteOfficer,
    quoteDate,
    entryType,
  });
  return postBinary(`${path}?${query.toString()}`, await file.arrayBuffer());
}

export function previewQuoteStatistics(file, quoteOfficer, quoteDate, entryType) {
  return sendQuoteFile("/api/quote-statistics/preview", file, quoteOfficer, quoteDate, entryType);
}

export function commitQuoteStatistics(file, quoteOfficer, quoteDate, entryType) {
  return sendQuoteFile("/api/quote-statistics/commit", file, quoteOfficer, quoteDate, entryType);
}

export function createQuoteStatisticEntry(entry) {
  return postJson("/api/quote-statistics/manual", entry);
}
