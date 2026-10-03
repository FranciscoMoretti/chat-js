"use client";

import dynamic from "next/dynamic";

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { ScrollArea } from "@/components/ui/scroll-area";
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import type { DocumentUi } from "@/lib/eve/document-ui";
/* oxlint-enable eslint/sort-imports */

import { EveDocumentComparison } from "./comparison";

/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
// oxlint-disable-next-line promise/prefer-await-to-then
const Editor = dynamic(() => import("./editor").then((m) => m.Editor), {
  ssr: false,
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable eslint/id-length */

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable react/forbid-component-props -- The composed UI component exposes this styling prop as part of its supported public API. */
/* oxlint-disable react/react-in-jsx-scope -- The TypeScript/Next automatic JSX runtime supplies JSX helpers; a legacy React binding is not required for rendering. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
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
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/forbid-component-props */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
