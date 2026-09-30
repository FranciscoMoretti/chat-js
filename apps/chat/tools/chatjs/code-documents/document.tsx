"use client";

import dynamic from "next/dynamic";

import { ScrollArea } from "@/components/ui/scroll-area";
import type { DocumentUi } from "@/lib/eve/document-ui";
import { getLanguageFromFileName } from "@/lib/utils";

// oxlint-disable-next-line promise/prefer-await-to-then
const CodeEditor = dynamic(() => import("./editor").then((m) => m.CodeEditor), {
  ssr: false,
});

export const documentUi: DocumentUi = {
  Body: ({ title, editorProps }) => (
    <ScrollArea className="min-h-0 flex-1">
      <CodeEditor
        {...editorProps}
        language={getLanguageFromFileName(title) || "python"}
      />
    </ScrollArea>
  ),
};
