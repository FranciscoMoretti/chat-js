"use client";
import dynamic from "next/dynamic";
import React from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import type { DocumentUi } from "@/lib/eve/document-ui";
import { getLanguageFromFileName } from "@/lib/utils";

/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
// oxlint-disable-next-line promise/prefer-await-to-then -- Next dynamic expects a loader promise selecting the named editor export; this then maps the module to that component.
const CodeEditor = dynamic(() => import("./editor").then((m) => m.CodeEditor), {
  ssr: false,
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable eslint/id-length */

/* oxlint-disable react/forbid-component-props -- The composed UI component exposes this styling prop as part of its supported public API. */
/* oxlint-disable react/jsx-props-no-spreading -- Forward the component or form-library prop contract intact, including accessibility and event bindings. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable react/jsx-props-no-spreading */
/* oxlint-enable react/forbid-component-props */
