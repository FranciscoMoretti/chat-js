"use client";

import type { EveMessagePart } from "eve/client";
import { useEffect, useRef } from "react";
import { useIsClient } from "usehooks-ts";
import { DocumentToolResult } from "@/components/part/document-common";
import { useArtifact } from "@/hooks/use-artifact";
import { eveDocumentResult } from "@/lib/eve/document-contracts";

export function EveDocumentTool({
  part,
  messageId,
  isReadonly,
}: {
  part: Extract<EveMessagePart, { type: "dynamic-tool" }>;
  messageId: string;
  isReadonly: boolean;
}) {
  const isClient = useIsClient();
  const { setArtifact } = useArtifact();
  const pendingCall = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (part.state === "input-streaming" || part.state === "input-available") {
      pendingCall.current = part.toolCallId;
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
    if (
      !wasPending ||
      isReadonly ||
      part.state !== "output-available" ||
      part.toolName === "readDocument"
    ) {
      return;
    }
    const completed = eveDocumentResult.safeParse(part.output);
    if (!completed.success) {
      return;
    }
    setArtifact((current) =>
      current.isVisible
        ? current
        : {
            documentId: completed.data.documentId,
            revisionId: completed.data.revisionId,
            kind: completed.data.kind,
            title: completed.data.title,
            content: "",
            messageId,
            status: "idle",
            isVisible: true,
          }
    );
  }, [part, isReadonly, messageId, setArtifact]);
  if (part.state === "output-error") {
    return <p role="alert">{part.errorText}</p>;
  }
  if (part.state === "output-denied") {
    return <p>Document operation declined.</p>;
  }
  if (part.state !== "output-available") {
    return (
      <p role="status">
        {part.toolName === "readDocument"
          ? "Reading document…"
          : "Writing document…"}
      </p>
    );
  }
  const result = eveDocumentResult.safeParse(part.output);
  if (!result.success) {
    return <p role="alert">This document result could not be displayed.</p>;
  }
  const writeAction = part.toolName.startsWith("create") ? "create" : "update";
  return (
    <DocumentToolResult
      disabled={!isClient}
      isReadonly={isReadonly}
      messageId={messageId}
      result={{ ...result.data, id: result.data.documentId }}
      type={part.toolName === "readDocument" ? "read" : writeAction}
    />
  );
}
