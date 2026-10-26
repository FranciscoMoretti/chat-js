"use client";
import type { DocumentBodyProps, DocumentUi } from "@/lib/eve/document-ui";
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
  Body: ({ title, editorProps }: ReadonlyNativeSurface<DocumentBodyProps>) => (
    <ScrollArea className="min-h-0 flex-1">
      <CodeEditor
        {...editorProps}
        language={getLanguageFromFileName(title) || "python"}
      />
    </ScrollArea>
  ),
};
