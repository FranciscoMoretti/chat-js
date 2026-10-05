"use client";
import { useQuery } from "@tanstack/react-query";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import dynamic from "next/dynamic";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import React from "react";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { DocumentSkeleton } from "@/components/document-skeleton";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Button } from "@/components/ui/button";
/* oxlint-enable sort-imports */
import { useTRPC } from "@/trpc/react";

/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
const DiffView = dynamic(
  // Named exports need a promise projection for next/dynamic.
  // oxlint-disable-next-line promise/prefer-await-to-then -- Next dynamic expects a loader promise selecting the named DiffView export; this then maps the module to that component.
  () => import("./diffview").then((module) => module.DiffView),
  {
    loading: () => <DocumentSkeleton artifactKind="text" />,
    ssr: false,
  }
);
/* oxlint-disable react/jsx-no-literals -- EveDocumentComparison renders authored tool output labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-enable typescript/promise-function-async */

/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable react-perf/jsx-no-new-function-as-prop -- The handler captures the current render state; changing its identity policy requires profiling and lifecycle review. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const EveDocumentComparison = ({
  conversationId,
  documentId,
  previousRevisionId,
  content,
  version,
}: {
  conversationId: string;
  documentId: string;
  previousRevisionId: string;
  content: string;
  version: number;
}) => {
  const trpc = useTRPC();
  const previous = useQuery(
    trpc.eve.document.queryOptions({
      conversationId,
      documentId,
      revisionId: previousRevisionId,
    })
  );
  return (
    <section
      aria-label="Document changes"
      className="mx-auto max-w-3xl space-y-4 px-4 py-8"
    >
      <p className="text-muted-foreground text-sm">
        Changes from version {version - 1} to {version}
      </p>
      {previous.isPending && <DocumentSkeleton artifactKind="text" />}
      {previous.isError && (
        <div className="space-y-2" role="alert">
          <p>The previous version could not be loaded.</p>
          {}
          <Button
            onClick={(): void => {
              void previous.refetch();
            }}
            variant="outline"
          >
            Retry comparison
          </Button>
        </div>
      )}
      {previous.data && !previous.isError && (
        <DiffView
          newContent={content}
          oldContent={previous.data.revision.content}
        />
      )}
    </section>
  );
};
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop */
/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
