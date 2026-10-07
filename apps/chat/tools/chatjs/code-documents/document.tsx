"use client";
import dynamic from "next/dynamic";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import React from "react";
/* oxlint-enable sort-imports */

import { ScrollArea } from "@/components/ui/scroll-area";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { DocumentBodyProps, DocumentUi } from "@/lib/eve/document-ui";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { getLanguageFromFileName } from "@/lib/utils";

import type { CodeEditor as CodeEditorExport } from "./editor";
/* oxlint-enable sort-imports */

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
