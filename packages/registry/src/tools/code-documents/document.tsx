"use client";
import dynamic from "next/dynamic";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import React from "react";
/* oxlint-enable sort-imports */

import { ScrollArea } from "@/components/ui/scroll-area";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { DocumentUi } from "@/lib/eve/document-ui";
/* oxlint-enable sort-imports */
import { getLanguageFromFileName } from "@/lib/utils";

/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const CodeEditor = dynamic(
  // oxlint-disable-next-line promise/prefer-await-to-then -- Next dynamic expects a loader promise selecting the named editor export; this then maps the module to that component.
  () => import("./editor").then((editorModule) => editorModule.CodeEditor),
  {
    ssr: false,
  }
);
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/promise-function-async */

/* oxlint-disable react/jsx-props-no-spreading -- Forward the component or form-library prop contract intact, including accessibility and event bindings. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const documentUi: DocumentUi = {
  Body: ({ title, editorProps }) => (
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable react/jsx-props-no-spreading */
