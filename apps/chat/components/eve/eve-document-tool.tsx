"use client";

import { documentDefinitions } from "@/integrations/documents";

import { hasText } from "@/components/text-value";

import type { JSX as ReactJSX } from "react";
import React, { useEffect, useRef } from "react";
import { useIsClient } from "usehooks-ts";
import { z } from "zod";

import { DocumentToolResult } from "@/components/part/document-common";
import { useArtifact } from "@/hooks/use-artifact";
import { eveDocumentResult } from "@/lib/eve/document-contracts";
import type { ReadonlyEveMessagePart } from "@/lib/eve/readonly-message-types";

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

export const EveDocumentTool = ({
  part,
  messageId,
  isReadonly,
  preview = false,
}: {
  readonly part: Extract<
    ReadonlyEveMessagePart,
    { readonly type: "dynamic-tool" }
  >;
  readonly messageId: string;
  readonly isReadonly: boolean;
  readonly preview?: boolean;
}): ReactJSX.Element => {
  const isClient = useIsClient();
  const replaying = useDocumentReplaying();
  const conversationId = useDocumentConversation();
  const { setArtifact } = useArtifact();
  // oxlint-disable-next-line unicorn/no-useless-undefined -- React requires an initial ref value; undefined represents the uninitialized state.
  const pendingCall = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (replaying) {
      pendingCall.current = undefined;
      return;
    }
    const operation = documentDefinitions.operations.get(part.toolName);
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
      if (!(completed?.success === true)) {
        if (current.previewCallId === part.toolCallId) {
          return {
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
  const completedOperation = documentDefinitions.operations.get(part.toolName);
  const writeAction =
    completedOperation?.edit === false ||
    (!completedOperation && part.toolName.startsWith("create"))
      ? "create"
      : "update";
  if (preview && hasText(conversationId)) {
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
