import { parse, unparse } from "papaparse";
import type { ArtifactReference } from "@/components/artifact-actions";

const MAX_BYTES = 32 * 1024 * 1024;
const MAX_ROWS = 5000;
const MAX_COLUMNS = 200;
const XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const spreadsheetFormat = (
  artifact: ArtifactReference
): "csv" | "tsv" | "xlsx" | null => {
  const extension = artifact.name.split(".").at(-1)?.toLowerCase();
  if (extension === "xlsx" || artifact.mediaType === XLSX) {
    return "xlsx";
  }
  if (
    extension === "tsv" ||
    artifact.mediaType === "text/tab-separated-values"
  ) {
    return "tsv";
  }
  if (extension === "csv" || artifact.mediaType === "text/csv") {
    return "csv";
  }
  return null;
};
export interface SpreadsheetSheet {
  readonly name: string;
  readonly content: string;
  readonly truncated: boolean;
}
const cellValue = (value: unknown): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
    ? String(value)
    : "";
};
const asSheet = (
  name: string,
  rows: readonly (readonly unknown[])[]
): SpreadsheetSheet => ({
  name,
  content: unparse(
    rows
      .slice(0, MAX_ROWS)
      .map((row) => row.slice(0, MAX_COLUMNS).map((value) => cellValue(value)))
  ),
  truncated:
    rows.length > MAX_ROWS || rows.some((row) => row.length > MAX_COLUMNS),
});
export const parseSpreadsheet = async (
  blob: Blob,
  format: "csv" | "tsv" | "xlsx"
): Promise<SpreadsheetSheet[]> => {
  if (blob.size > MAX_BYTES) {
    throw new Error(
      "Preview supports files up to 32 MiB. Download this file to open it."
    );
  }
  if (format === "xlsx") {
    const { default: readWorkbook } = await import("read-excel-file/browser");
    const sheets = await readWorkbook(blob);
    return sheets.map((sheet) => asSheet(sheet.sheet, sheet.data));
  }
  const text = await blob.text();
  const parsed = parse<string[]>(text, {
    delimiter: format === "tsv" ? "\t" : ",",
    skipEmptyLines: true,
    preview: MAX_ROWS + 1,
  });
  if (parsed.errors.length > 0) {
    throw new Error(
      "This spreadsheet could not be read. Download it to open it in another app."
    );
  }
  return [asSheet("Sheet 1", parsed.data)];
};
export const loadSpreadsheet = async (
  artifact: ArtifactReference,
  signal: AbortSignal
): Promise<SpreadsheetSheet[]> => {
  const format = spreadsheetFormat(artifact);
  if (!format) {
    throw new Error("Unsupported spreadsheet format.");
  }
  const response = await fetch(artifact.url, { signal });
  if (!response.ok || !response.body) {
    throw new Error("This file is unavailable or you no longer have access.");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  try {
    while (true) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Bound the stream before reading its next chunk.
      const next = await reader.read();
      if (next.done) {
        break;
      }
      size += next.value.byteLength;
      if (size > MAX_BYTES) {
        throw new Error(
          "Preview supports files up to 32 MiB. Download this file to open it."
        );
      }
      chunks.push(new Uint8Array(next.value));
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  signal.throwIfAborted();
  const result = await parseSpreadsheet(new Blob(chunks), format);
  signal.throwIfAborted();
  return result;
};
