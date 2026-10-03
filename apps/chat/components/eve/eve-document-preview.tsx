"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import { useQuery } from "@tanstack/react-query";
import { File, Maximize, Pencil } from "lucide-react";
import React from "react";
import type { ReactNode } from "react";
import type { z } from "zod";

import { DocumentToolResult } from "@/components/part/document-common";
import { useArtifact } from "@/hooks/use-artifact";
import type { eveDocumentResult } from "@/lib/eve/document-contracts";
import { useTRPC } from "@/trpc/react";

import { DocumentBody } from "./eve-document-body";
/* oxlint-enable sort-imports */
/* oxlint-disable import/no-named-export, import/prefer-default-export, max-lines-per-function, max-statements, no-magic-numbers, no-ternary, no-undefined, oxc/no-optional-chaining, oxc/no-rest-spread-properties, react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-new-object-as-prop, react/jsx-max-depth, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- EveDocumentPreview: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including -1); no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable (including action === "update" ? <Pencil size={16} /> : <File size={16} />); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback (including document.error.data?.code); oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react-perf/jsx-no-new-object-as-prop: this prop object derives from current render state or feature styling; hoisting changes its ownership; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const EveDocumentPreview = ({
  conversationId,
  result,
  messageId,
  action,
  isReadonly,
}: {
  isReadonly: boolean;
  action: "create" | "update" | "read";
  conversationId: string;
  result: z.infer<typeof eveDocumentResult>;
  messageId: string;
}) => {
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
      document.error.data?.code === "NOT_FOUND"
        ? "Document is no longer available in this conversation."
        : "Open document to retry loading.";
  }
  let content: ReactNode = (
    <p className="text-muted-foreground">{loadingMessage}</p>
  );
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
        result={{ ...result, id: result.documentId }}
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
            {action === "update" ? <Pencil size={16} /> : <File size={16} />}
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
            revisionId: isLatest ? undefined : result.revisionId,
            status: "idle",
            title: result.title,
          })
        }
      />
    </div>
  );
};
/* oxlint-enable import/no-named-export, import/prefer-default-export, max-lines-per-function, max-statements, no-magic-numbers, no-ternary, no-undefined, oxc/no-optional-chaining, oxc/no-rest-spread-properties, react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-new-object-as-prop, react/jsx-max-depth, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
