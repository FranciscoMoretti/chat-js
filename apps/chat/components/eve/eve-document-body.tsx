"use client";
import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { getLanguageFromFileName } from "@/lib/utils";

import { EveDocumentComparison } from "./eve-document-comparison";

const Editor = dynamic(
  // next/dynamic requires a promise projection for named exports.
  // oxlint-disable-next-line promise/prefer-await-to-then
  () => import("@/components/text-editor").then((m) => m.Editor),
  { ssr: false }
);
const CodeEditor = dynamic(
  // next/dynamic requires a promise projection for named exports.
  // oxlint-disable-next-line promise/prefer-await-to-then
  () => import("@/components/code-editor").then((m) => m.CodeEditor),
  { ssr: false }
);
const SpreadsheetEditor = dynamic(
  // next/dynamic requires a promise projection for named exports.
  // oxlint-disable-next-line promise/prefer-await-to-then
  () => import("@/components/sheet-editor").then((m) => m.SpreadsheetEditor),
  { ssr: false }
);

export const DocumentBody = ({
  kind,
  title,
  editorProps,
  comparison,
  inline = false,
}: {
  inline?: boolean;
  kind: "text" | "code" | "sheet";
  title: string;
  editorProps: ComponentProps<typeof Editor>;
  comparison?: ComponentProps<typeof EveDocumentComparison>;
}) => {
  if (kind === "sheet") {
    return (
      <div className="min-h-0 flex-1 overflow-hidden">
        <SpreadsheetEditor
          {...editorProps}
          saveContent={editorProps.onSaveContent}
        />
      </div>
    );
  }
  return (
    <ScrollArea className="min-h-0 flex-1">
      {kind === "code" && (
        <CodeEditor
          {...editorProps}
          language={getLanguageFromFileName(title) || "python"}
        />
      )}
      {kind === "text" &&
        (comparison ? (
          <EveDocumentComparison {...comparison} />
        ) : (
          <div
            className={
              inline ? "p-4 sm:px-14 sm:py-16" : "mx-auto max-w-3xl px-4 py-8"
            }
          >
            <Editor {...editorProps} />
          </div>
        ))}
    </ScrollArea>
  );
};
