"use client";
import type { DocumentBodyProps, DocumentUi } from "@/lib/eve/document-ui";
import { parse, unparse } from "papaparse";
import React from "react";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import dynamic from "next/dynamic";

const SpreadsheetEditor = dynamic(
  async () => {
    const { SpreadsheetEditor: Editor } = await import("./editor");
    return Editor;
  },
  { ssr: false }
);

export const documentUi: DocumentUi = {
  Body: ({ editorProps }: ReadonlyNativeSurface<DocumentBodyProps>) => (
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
      parsed.data.filter((row: readonly string[]) =>
        row.some((cell) => cell.trim() !== "")
      )
    );
  },
};
