"use client";
/* oxlint-disable eslint/sort-imports -- Oxfmt groups the React value import with existing dependencies and local types; preserve formatter ordering. */
import dynamic from "next/dynamic";
import { parse, unparse } from "papaparse";
import React from "react";

import type { DocumentUi } from "@/lib/eve/document-ui";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const SpreadsheetEditor = dynamic(
  // oxlint-disable-next-line promise/prefer-await-to-then
  () => import("./editor").then((m) => m.SpreadsheetEditor),
  { ssr: false }
);
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable eslint/id-length */

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable react/jsx-props-no-spreading -- Forward the component or form-library prop contract intact, including accessibility and event bindings. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const documentUi: DocumentUi = {
  Body: ({ editorProps }) => (
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
      parsed.data.filter((row) => row.some((cell) => cell.trim() !== ""))
    );
  },
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable react/jsx-props-no-spreading */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
