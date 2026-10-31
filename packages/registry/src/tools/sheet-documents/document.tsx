"use client";
import type { DocumentBodyProps, DocumentUi } from "@/lib/eve/document-ui";
import { parse, unparse } from "papaparse";
import { documentDefinition } from "./definition";
import { documentAssistantActions } from "./assistant-actions";
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
  copyLabel: "Copy as .csv",
  copySuccessMessage: "Copied csv to clipboard!",
  copyIconSize: 16,
  copyButtonClassName: "hover:bg-accent h-fit p-2",
  definition: documentDefinition,
  assistantActions: documentAssistantActions,
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
