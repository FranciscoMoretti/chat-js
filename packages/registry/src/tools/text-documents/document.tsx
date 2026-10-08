"use client";
import type { DocumentBodyProps, DocumentUi } from "@/lib/eve/document-ui";
import type { Editor as EditorExport } from "./editor";
import React from "react";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { ScrollArea } from "@/components/ui/scroll-area";
// oxlint-disable-next-line sort-imports -- ScrollArea loads ReactDOM and invokes its devtools hook before comparison can fail environment validation through trpc/react → env; preserve that callback and failure order.
import { EveDocumentComparison } from "./comparison";
import dynamic from "next/dynamic";

/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
const Editor = dynamic(
  () =>
    // oxlint-disable-next-line promise/prefer-await-to-then -- Next dynamic requires a loader promise selecting the named editor export.
    import("./editor").then(
      (
        editorModule: Readonly<{
          Editor: React.ExoticComponent<
            React.ComponentProps<typeof EditorExport>
          >;
        }>
      ) => editorModule.Editor
    ),
  {
    ssr: false,
  }
);
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (documentUi); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable typescript/promise-function-async */

/* oxlint-disable react/jsx-props-no-spreading -- Forward the component or form-library prop contract intact, including accessibility and event bindings. */
export const documentUi: DocumentUi = {
  Body: ({
    inline,
    editorProps,
    comparison,
  }: ReadonlyNativeSurface<DocumentBodyProps>) => (
    <ScrollArea
      // oxlint-disable-next-line react/forbid-component-props -- ScrollArea accepts className in its styling contract; preserve this caller's layout and appearance.
      className="min-h-0 flex-1"
    >
      {
        // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        comparison ? (
          <EveDocumentComparison {...comparison} />
        ) : (
          <div
            className={
              // oxlint-disable-next-line no-ternary -- Keep className JSX attribute as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
              inline === true
                ? "p-4 sm:px-14 sm:py-16"
                : "mx-auto max-w-3xl px-4 py-8"
            }
          >
            <Editor {...editorProps} />
          </div>
        )
      }
    </ScrollArea>
  ),
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-props-no-spreading */
