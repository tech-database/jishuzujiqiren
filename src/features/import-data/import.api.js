import { postBinary } from "../../shared/api/client.js";

export async function uploadSpreadsheet(file, tableKey) {
  const query = new URLSearchParams({ fileName: file.name, tableKey });
  try {
    return await postBinary(`/api/upload-spreadsheet?${query.toString()}`, await file.arrayBuffer());
  } catch (error) {
    error.fileName = file.name;
    error.phase = "server";
    throw error;
  }
}
