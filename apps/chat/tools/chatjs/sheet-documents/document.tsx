"use client";
import dynamic from "next/dynamic";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { parse, unparse } from "papaparse";
/* oxlint-enable sort-imports */
import React from "react";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { DocumentBodyProps, DocumentUi } from "@/lib/eve/document-ui";
/* oxlint-enable sort-imports */
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import type { SpreadsheetEditor as SpreadsheetEditorExport } from "./editor";

/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
const SpreadsheetEditor = dynamic(
  () =>
    // oxlint-disable-next-line promise/prefer-await-to-then -- Next dynamic expects a loader promise selecting the named editor export; this then maps the module to that component.
    import("./editor").then(
      (
        editorModule: Readonly<{
          SpreadsheetEditor: React.ExoticComponent<
            React.ComponentProps<typeof SpreadsheetEditorExport>
          >;
        }>
      ) => editorModule.SpreadsheetEditor
    ),
  { ssr: false }
);
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (documentUi); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable typescript/promise-function-async */

/* oxlint-disable react/jsx-props-no-spreading -- Forward the component or form-library prop contract intact, including accessibility and event bindings. */
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-props-no-spreading */
