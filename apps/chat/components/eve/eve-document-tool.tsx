"use client";

import type { EveMessagePart } from "eve/client";
import { useIsClient } from "usehooks-ts";
import { DocumentToolResult } from "@/components/part/document-common";
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
