"use client";
import dynamic from "next/dynamic";
import React from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import type { DocumentUi } from "@/lib/eve/document-ui";

import { EveDocumentComparison } from "./comparison";

/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
// oxlint-disable-next-line promise/prefer-await-to-then -- Next dynamic expects a loader promise selecting the named editor export; this then maps the module to that component.
const Editor = dynamic(() => import("./editor").then((m) => m.Editor), {
  ssr: false,
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable eslint/id-length */

/* oxlint-disable react/jsx-props-no-spreading -- Forward the component or form-library prop contract intact, including accessibility and event bindings. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const documentUi: DocumentUi = {
  Body: ({ inline, editorProps, comparison }) => (
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable react/jsx-props-no-spreading */
