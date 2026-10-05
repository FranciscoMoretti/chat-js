"use client";

import type { EveMessagePart } from "eve/client";
import type { JSX as ReactJSX } from "react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import React, { useEffect, useRef } from "react";
/* oxlint-enable sort-imports */
import { useIsClient } from "usehooks-ts";
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { DocumentToolResult } from "@/components/part/document-common";
/* oxlint-enable sort-imports */
import { useArtifact } from "@/hooks/use-artifact";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  eveDocumentOperations,
  eveDocumentResult,
} from "@/lib/eve/document-contracts";
/* oxlint-enable sort-imports */

import {
  useDocumentConversation,
  useDocumentReplaying,
} from "./eve-document-context";
import { EveDocumentPreview } from "./eve-document-preview";

const partialDocument = z.object({
  content: z.string().optional(),
  documentId: z.string().optional(),
  title: z.string().optional(),
});
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (EveDocumentTool); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-no-literals -- EveDocumentTool renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, react-perf/jsx-no-new-object-as-prop, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- EveDocumentTool: ; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 1); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react-perf/jsx-no-new-object-as-prop: this prop object derives from current render state or feature styling; hoisting changes its ownership; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including [name]); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including completed?.success). */

export const EveDocumentTool = ({
  part,
  messageId,
  isReadonly,
  preview = false,
}: {
  part: Extract<EveMessagePart, { type: "dynamic-tool" }>;
  messageId: string;
  isReadonly: boolean;
  preview?: boolean;
}): ReactJSX.Element => {
  const isClient = useIsClient();
  const replaying = useDocumentReplaying();
  const conversationId = useDocumentConversation();
  const { setArtifact } = useArtifact();
  const pendingCall = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (replaying) {
      pendingCall.current = undefined;
      return;
    }
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading 1 from Object.entries(...).find(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    const operation = Object.entries(eveDocumentOperations).find(
      ([name]) => name === part.toolName
    )?.[1];
    if (part.state === "input-streaming" || part.state === "input-available") {
      pendingCall.current = part.toolCallId;
      const input = partialDocument.safeParse(part.input);
      if (isReadonly || !operation || !input.success) {
        return;
      }
      const { data } = input;
      setArtifact((current) => {
        // A user-selected historical revision or another open document is never stolen by a stream.
        if (
          current.isVisible &&
          (current.followLive === false ||
            (current.documentId !== "init" &&
              current.documentId !== data.documentId))
        ) {
          return current;
        }
        return {
          // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing current own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
          ...current,
          content: data.content ?? "",
          conversationId,
          documentId: data.documentId ?? "init",
          followLive: true,
          isVisible:
            current.previewCallId === part.toolCallId
              ? current.isVisible
              : true,
          kind: operation.kind,
          messageId,
          previewCallId: part.toolCallId,
          status: "streaming",
          title: data.title ?? current.title,
        };
      });
      return;
    }
    if (
      part.state !== "output-available" &&
      part.state !== "output-error" &&
      part.state !== "output-denied"
    ) {
      return;
    }
    const wasPending = pendingCall.current === part.toolCallId;
    pendingCall.current = undefined;
    if (!wasPending || isReadonly || !operation) {
      return;
    }
    const completed =
      part.state === "output-available"
        ? eveDocumentResult.safeParse(part.output)
        : undefined;
    setArtifact((current) => {
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading success from completed; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      if (!completed?.success) {
        if (current.previewCallId === part.toolCallId) {
          return {
            // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing current own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
            ...current,
            isVisible: current.documentId !== "init",
            previewCallId: undefined,
            status: "idle",
          };
        }
        return current;
      }
      if (
        current.isVisible &&
        (current.followLive === false ||
          (current.documentId !== "init" &&
            current.documentId !== completed.data.documentId))
      ) {
        return current;
      }
      return {
        content: "",
        conversationId,
        date: completed.data.date,
        documentId: completed.data.documentId,
        followLive: true,
        isVisible:
          current.previewCallId === part.toolCallId ? current.isVisible : true,
        kind: completed.data.kind,
        messageId,
        status: "idle",
        title: completed.data.title,
      };
    });
  }, [part, isReadonly, messageId, setArtifact, conversationId, replaying]);
  if (part.state === "output-error") {
    return <p role="alert">{part.errorText}</p>;
  }
  if (part.state === "output-denied") {
    return <p>Document operation declined.</p>;
  }
  if (part.state !== "output-available") {
    return (
      <output>
        {part.toolName === "readDocument"
          ? "Reading document…"
          : "Writing document…"}
      </output>
    );
  }
  const result = eveDocumentResult.safeParse(part.output);
  if (!result.success) {
    return <p role="alert">This document result could not be displayed.</p>;
  }
  const writeAction = part.toolName.startsWith("create") ? "create" : "update";
  if (preview && conversationId) {
    return (
      <EveDocumentPreview
        isReadonly={isReadonly}
        action={part.toolName === "readDocument" ? "read" : writeAction}
        conversationId={conversationId}
        result={result.data}
        messageId={messageId}
      />
    );
  }
  return (
    <DocumentToolResult
      disabled={!isClient}
      isReadonly={isReadonly}
      messageId={messageId}
      result={
        /* oxlint-disable oxc/no-rest-spread-properties -- Keep the existing result.data own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement. */
        { ...result.data, id: result.data.documentId }
        /* oxlint-enable oxc/no-rest-spread-properties */
      }
      type={part.toolName === "readDocument" ? "read" : writeAction}
    />
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, react-perf/jsx-no-new-object-as-prop, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
