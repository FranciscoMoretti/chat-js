"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import type { EveMessagePart } from "eve/client";
import React, { useEffect, useRef } from "react";
import { useIsClient } from "usehooks-ts";
import { z } from "zod";

import { DocumentToolResult } from "@/components/part/document-common";
import { useArtifact } from "@/hooks/use-artifact";
import {
  eveDocumentOperations,
  eveDocumentResult,
} from "@/lib/eve/document-contracts";

import {
  useDocumentConversation,
  useDocumentReplaying,
} from "./eve-document-context";
import { EveDocumentPreview } from "./eve-document-preview";
/* oxlint-enable sort-imports */

const partialDocument = z.object({
  content: z.string().optional(),
  documentId: z.string().optional(),
  title: z.string().optional(),
});
/* oxlint-disable import/no-named-export, import/prefer-default-export, max-lines-per-function, max-statements, no-magic-numbers, no-ternary, no-undefined, oxc/no-optional-chaining, oxc/no-rest-spread-properties, react-perf/jsx-no-new-object-as-prop, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- EveDocumentTool: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 1); no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable (including part.toolName.startsWith("create") ? "create" : "update"); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback (including completed?.success); oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react-perf/jsx-no-new-object-as-prop: this prop object derives from current render state or feature styling; hoisting changes its ownership; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including [name]); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including completed?.success). */

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
}) => {
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
      if (!completed?.success) {
        return current.previewCallId === part.toolCallId
          ? {
              ...current,
              isVisible: current.documentId !== "init",
              previewCallId: undefined,
              status: "idle",
            }
          : current;
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
      result={{ ...result.data, id: result.data.documentId }}
      type={part.toolName === "readDocument" ? "read" : writeAction}
    />
  );
};
/* oxlint-enable import/no-named-export, import/prefer-default-export, max-lines-per-function, max-statements, no-magic-numbers, no-ternary, no-undefined, oxc/no-optional-chaining, oxc/no-rest-spread-properties, react-perf/jsx-no-new-object-as-prop, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
