"use client";

import dynamic from "next/dynamic";

import { ScrollArea } from "@/components/ui/scroll-area";
import type { DocumentUi } from "@/lib/eve/document-ui";

import { EveDocumentComparison } from "./comparison";

// oxlint-disable-next-line promise/prefer-await-to-then
const Editor = dynamic(() => import("./editor").then((m) => m.Editor), {
  ssr: false,
});

export const documentUi: DocumentUi = {
  Body: ({ inline, editorProps, comparison }) => (
    <ScrollArea className="min-h-0 flex-1">
      {comparison ? (
        <EveDocumentComparison {...comparison} />
      ) : (
        <div
          className={
            inline ? "p-4 sm:px-14 sm:py-16" : "mx-auto max-w-3xl px-4 py-8"
          }
        >
          <Editor {...editorProps} />
        </div>
      )}
    </ScrollArea>
  ),
};
