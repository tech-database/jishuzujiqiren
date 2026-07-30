import { postBinary, postJson } from "../../shared/api/client.js";

async function sendQuoteFile(path, file, quoteOfficer, quoteDate) {
  const query = new URLSearchParams({
    fileName: file.name,
    quoteOfficer,
    quoteDate,
  });
  return postBinary(`${path}?${query.toString()}`, await file.arrayBuffer());
}

export function previewQuoteStatistics(file, quoteOfficer, quoteDate) {
  return sendQuoteFile("/api/quote-statistics/preview", file, quoteOfficer, quoteDate);
}

export function commitQuoteStatistics(file, quoteOfficer, quoteDate) {
  return sendQuoteFile("/api/quote-statistics/commit", file, quoteOfficer, quoteDate);
}

export function createQuoteStatisticEntry(entry) {
  return postJson("/api/quote-statistics/manual", entry);
}
