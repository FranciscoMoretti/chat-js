"use client";

import { useQuery } from "@tanstack/react-query";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { File, Maximize, Pencil } from "lucide-react";
/* oxlint-enable sort-imports */
import type { JSX as ReactJSX, ReactNode } from "react";
import React from "react";
import type { z } from "zod";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { DocumentToolResult } from "@/components/part/document-common";
/* oxlint-enable sort-imports */
import { useArtifact } from "@/hooks/use-artifact";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { eveDocumentResult } from "@/lib/eve/document-contracts";
/* oxlint-enable sort-imports */
import { useTRPC } from "@/trpc/react";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { DocumentBody } from "./eve-document-body";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (EveDocumentPreview); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable sort-imports */
/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, react-perf/jsx-no-new-object-as-prop, react/jsx-max-depth -- EveDocumentPreview: ; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including -1); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react-perf/jsx-no-new-object-as-prop: this prop object derives from current render state or feature styling; hoisting changes its ownership; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships */

export const EveDocumentPreview = ({
  conversationId,
  result,
  messageId,
  action,
  isReadonly,
}: {
  readonly isReadonly: boolean;
  readonly action: "create" | "update" | "read";
  readonly conversationId: string;
  readonly result: z.infer<typeof eveDocumentResult>;
  readonly messageId: string;
}): ReactJSX.Element => {
  const trpc = useTRPC();
  const { artifact, setArtifact } = useArtifact();
  const document = useQuery(
    trpc.eve.document.queryOptions({
      conversationId,
      documentId: result.documentId,
      revisionId: result.revisionId,
    })
  );
  let loadingMessage = "Loading document…";
  if (document.isError) {
    loadingMessage =
      // oxlint-disable-next-line oxc/no-optional-chaining, no-ternary -- Keep the existing nullish guard when reading code from document.error.data; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.; no-ternary: Keep = operand as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      document.error.data?.code === "NOT_FOUND"
        ? "Document is no longer available in this conversation."
        : "Open document to retry loading.";
  }
  let content: ReactNode = (
    <p className="text-muted-foreground">{loadingMessage}</p>
  );
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading id from document.data.history.at(...); read history from document.data; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  const isLatest = document.data?.history.at(-1)?.id === result.revisionId;
  if (document.data && !document.isError) {
    content = (
      <DocumentBody
        inline
        title={result.title}
        kind={result.kind}
        editorProps={{
          content: document.data.revision.content,
          currentVersionIndex: 0,
          isCurrentVersion: true,
          isReadonly: true,
          onSaveContent: () => {
            /* Read-only preview never persists editor changes. */
          },
          status: "idle",
        }}
      />
    );
  }

  if (artifact.isVisible) {
    return (
      <DocumentToolResult
        followLive={isLatest}
        isReadonly={isReadonly}
        messageId={messageId}
        result={
          /* oxlint-disable oxc/no-rest-spread-properties -- Keep the existing result own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement. */
          { ...result, id: result.documentId }
          /* oxlint-enable oxc/no-rest-spread-properties */
        }
        type={action}
      />
    );
  }
  let actionText = "Updated";
  if (action === "read") {
    actionText = "Read";
  }
  if (action === "create") {
    actionText = "Created";
  }
  return (
    <div className="relative w-full" data-testid="document-preview">
      <div className="bg-muted flex flex-row items-start justify-between gap-2 rounded-t-2xl border border-b-0 p-4 sm:items-center">
        <div className="flex flex-row items-start gap-3 sm:items-center">
          <div className="text-muted-foreground">
            {
              // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
              action === "update" ? <Pencil size={16} /> : <File size={16} />
            }
          </div>
          <div className="-translate-y-1 font-medium sm:translate-y-0">
            {result.title}
          </div>
        </div>
        <Maximize size={16} />
      </div>
      <div
        className="bg-muted pointer-events-none flex h-[257px] flex-col overflow-hidden rounded-b-2xl border border-t-0"
        aria-hidden="true"
      >
        {content}
      </div>
      <button
        type="button"
        className="focus-visible:outline-ring absolute inset-0 cursor-pointer rounded-2xl focus-visible:outline-2"
        aria-label={`${actionText} "${result.title}"`}
        title="Expand document"
        onClick={() =>
          setArtifact({
            content: "",
            conversationId,
            documentId: result.documentId,
            followLive: isLatest,
            isVisible: true,
            kind: result.kind,
            messageId,
            // oxlint-disable-next-line no-ternary -- Keep revisionId as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
            revisionId: isLatest ? undefined : result.revisionId,
            status: "idle",
            title: result.title,
          })
        }
      />
    </div>
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, react-perf/jsx-no-new-object-as-prop, react/jsx-max-depth */
