"use client";
import type { DocumentBodyProps, DocumentUi } from "@/chatjs/core/documents/ui";
import { documentDefinition } from "./definition";
import { documentAssistantActions } from "./assistant-actions";
import React from "react";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { ScrollArea } from "@/components/ui/scroll-area";
import dynamic from "next/dynamic";
import { getLanguageFromFileName } from "@/lib/file-language";

const CodeEditor = dynamic(
  async () => {
    const { CodeEditor: Editor } = await import("./editor");
    return Editor;
  },
  {
    ssr: false,
  }
);

export const documentUi: DocumentUi = {
  copyLabel: "Copy code to clipboard",
  definition: documentDefinition,
  assistantActions: documentAssistantActions,
  Body: ({ title, editorProps }: ReadonlyNativeSurface<DocumentBodyProps>) => (
    <ScrollArea className="min-h-0 flex-1">
      <CodeEditor
        {...editorProps}
        language={getLanguageFromFileName(title) || "python"}
      />
    </ScrollArea>
  ),
};
