"use client";

import { isDocumentResult } from "@/chatjs/core/documents/contracts";

import React from "react";
import type { InputResponse } from "eve/client";
import { Response } from "@/components/ai-elements/response";
import { ToolInput, ToolOutput } from "@/components/part/tool-data";
import { ToolActivity } from "@/components/part/tool-activity";
import { ReasoningPart } from "@/components/part/message-reasoning";
import { EvePendingInput } from "./eve-pending-input";
import { parseToolId } from "@/lib/ai/mcp-name-id";
import { getEveInstalledToolRenderer } from "@/lib/ai/tool-renderer-registry";
import { documentDefinitions } from "@/integrations/documents/definitions";
import type { ReadonlyEveMessagePart } from "@/lib/eve/readonly-message-types";
import { EveAttachment } from "./eve-attachment";
import { EveDocumentTool } from "./eve-document-tool";
import { EveMcpResult } from "./eve-mcp-result";
import { EveToolResult } from "./eve-tool-result";

const toolStatus = (
  part: Extract<ReadonlyEveMessagePart, { type: "dynamic-tool" }>
): string => {
  if (part.state === "approval-requested") {
    return "Waiting for input.";
  }
  if (part.state === "output-denied") {
    return "Request declined.";
  }
  if (part.state === "output-error") {
    return part.errorText;
  }
  if (part.state === "output-available") {
    return "Tool completed.";
  }
  return "Working…";
};

const ToolFallback = ({
  part,
  disabled,
  respond,
}: {
  readonly part: Extract<ReadonlyEveMessagePart, { type: "dynamic-tool" }>;
  readonly disabled: boolean;
  readonly respond: (response: InputResponse) => void;
}): React.JSX.Element => {
  const request = part.toolMetadata?.eve?.inputRequest;
  let content: React.ReactNode = (
    <p className="text-muted-foreground text-sm">{toolStatus(part)}</p>
  );
  if (part.state === "approval-requested" && request) {
    content = (
      <EvePendingInput
        disabled={disabled}
        key={request.requestId}
        request={request}
        respond={respond}
      />
    );
  } else if (part.state === "output-error") {
    content = <ToolOutput errorText={part.errorText} />;
  } else if (part.state === "output-available" && part.output !== undefined) {
    content = <ToolOutput output={part.output} />;
  }
  return (
    <ToolActivity title={part.toolName} state={part.state} defaultOpen>
      <ToolInput input={part.input} />
      {content}
    </ToolActivity>
  );
};

// This renderer handles all streamed EVE part variants and their recovery states.

export const EveMessagePart = ({
  messageId,
  isReadonly,
  part,
  respond,
  inputDisabled,
  previewDocument = false,
}: {
  readonly previewDocument?: boolean;
  readonly messageId: string;
  readonly isReadonly: boolean;
  readonly part: ReadonlyEveMessagePart;
  readonly inputDisabled: boolean;
  readonly respond: (response: InputResponse) => void;
}): React.JSX.Element | null => {
  if (part.type === "text") {
    return <Response>{part.text}</Response>;
  }
  if (part.type === "file") {
    return <EveAttachment part={part} />;
  }
  if (part.type === "reasoning") {
    return (
      <ReasoningPart
        content={part.text}
        isLoading={part.state === "streaming"}
      />
    );
  }
  if (part.type === "step-start") {
    return null;
  }
  if (part.type !== "dynamic-tool") {
    return <p>Unsupported content in this conversation.</p>;
  }
  if (
    part.state === "approval-requested" ||
    part.state === "approval-responded"
  ) {
    return (
      <ToolFallback
        part={part}
        disabled={inputDisabled || isReadonly}
        respond={respond}
      />
    );
  }
  if (getEveInstalledToolRenderer(`tool-${part.toolName}`)) {
    return (
      <EveToolResult
        isReadonly={isReadonly}
        messageId={messageId}
        part={part}
      />
    );
  }

  if (
    documentDefinitions.operations.has(part.toolName) ||
    part.toolName === "readDocument" ||
    (part.state === "output-available" && isDocumentResult(part.output))
  ) {
    return (
      <EveDocumentTool
        preview={previewDocument}
        isReadonly={isReadonly}
        messageId={messageId}
        part={part}
      />
    );
  }
  if (parseToolId(part.toolName)) {
    return <EveMcpResult part={part} />;
  }
  return (
    <ToolFallback
      part={part}
      disabled={inputDisabled || isReadonly}
      respond={respond}
    />
  );
};
