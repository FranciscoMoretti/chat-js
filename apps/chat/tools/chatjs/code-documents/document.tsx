"use client";
import type { DocumentBodyProps, DocumentUi } from "@/lib/eve/document-ui";
import type { CodeEditor as CodeEditorExport } from "./editor";
import React from "react";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { ScrollArea } from "@/components/ui/scroll-area";
import dynamic from "next/dynamic";
import { getLanguageFromFileName } from "@/lib/utils";

/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
const CodeEditor = dynamic(
  () =>
    // oxlint-disable-next-line promise/prefer-await-to-then -- Next dynamic requires a loader promise selecting the named editor export.
    import("./editor").then(
      (
        editorModule: Readonly<{
          CodeEditor: React.ExoticComponent<
            React.ComponentProps<typeof CodeEditorExport>
          >;
        }>
      ) => editorModule.CodeEditor
    ),
  {
    ssr: false,
  }
);
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (documentUi); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable typescript/promise-function-async */

/* oxlint-disable react/jsx-props-no-spreading -- Forward the component or form-library prop contract intact, including accessibility and event bindings. */
export const documentUi: DocumentUi = {
  Body: ({ title, editorProps }: ReadonlyNativeSurface<DocumentBodyProps>) => (
    <ScrollArea
      // oxlint-disable-next-line react/forbid-component-props -- ScrollArea accepts className in its styling contract; preserve this caller's layout and appearance.
      className="min-h-0 flex-1"
    >
      <CodeEditor
        {...editorProps}
        language={getLanguageFromFileName(title) || "python"}
      />
    </ScrollArea>
  ),
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-props-no-spreading */
