"use client";

import dynamic from "next/dynamic";
import { parse, unparse } from "papaparse";

import type { DocumentUi } from "@/lib/eve/document-ui";

const SpreadsheetEditor = dynamic(
  // oxlint-disable-next-line promise/prefer-await-to-then
  () => import("./editor").then((m) => m.SpreadsheetEditor),
  { ssr: false }
);

export const documentUi: DocumentUi = {
  Body: ({ editorProps }) => (
    <div className="min-h-0 flex-1 overflow-hidden">
      <SpreadsheetEditor
        {...editorProps}
        saveContent={editorProps.onSaveContent}
      />
    </div>
  ),
  copyContent: (content) => {
    const parsed = parse<string[]>(content, { skipEmptyLines: true });
    return unparse(
      parsed.data.filter((row) => row.some((cell) => cell.trim() !== ""))
    );
  },
};
