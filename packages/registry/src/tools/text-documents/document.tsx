"use client";
import type { DocumentBodyProps, DocumentUi } from "@/lib/eve/document-ui";
import React from "react";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EveDocumentComparison } from "./comparison";
import dynamic from "next/dynamic";

const Editor = dynamic(
  async () => {
    const { Editor: TextEditor } = await import("./editor");
    return TextEditor;
  },
  {
    ssr: false,
  }
);

export const documentUi: DocumentUi = {
  Body: ({
    inline,
    editorProps,
    comparison,
  }: ReadonlyNativeSurface<DocumentBodyProps>) => (
    <ScrollArea className="min-h-0 flex-1">
      {comparison ? (
        <EveDocumentComparison {...comparison} />
      ) : (
        <div
          className={
            inline === true
              ? "p-4 sm:px-14 sm:py-16"
              : "mx-auto max-w-3xl px-4 py-8"
          }
        >
          <Editor {...editorProps} />
        </div>
      )}
    </ScrollArea>
  ),
};
