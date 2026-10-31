"use client";
import { eveToolUIState } from "@/lib/eve/tool-ui-state";

import { isDocumentResult } from "@/chatjs/core/documents/contracts";

import React, { useState } from "react";
import type { JSX as ReactJSX } from "react";
import type { InteractionRequest, Answer } from "eve/events";
import { Response } from "@/components/ai-elements/response";
import { ToolInput, ToolOutput } from "@/components/part/tool-data";
import { ToolActivity } from "@/components/part/tool-activity";
import { ReasoningPart } from "@/components/part/message-reasoning";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { parseToolId } from "@/lib/ai/mcp-name-id";
import { getEveInstalledToolRenderer } from "@/lib/ai/tool-renderer-registry";
import { documentDefinitions } from "@/integrations/documents/definitions";
import type { ReadonlyEveMessagePart } from "@/lib/eve/readonly-message-types";
import { EveAttachment } from "./eve-attachment";
import { EveDocumentTool } from "./eve-document-tool";
import { EveMcpResult } from "./eve-mcp-result";
import { EveToolResult } from "./eve-tool-result";

const PendingInput = ({
  request,
  disabled,
  respond,
}: {
  readonly request: InteractionRequest & { readonly interactionId: string };
  readonly disabled: boolean;
  readonly respond: (response: Answer) => void;
}): ReactJSX.Element => {
  const [text, setText] = useState("");
  return (
    <div className="space-y-3">
      <p>{request.prompt}</p>
      <div className="flex flex-wrap gap-2">
        {request.options?.map((option): React.JSX.Element => (
          <Button
            disabled={disabled}
            key={option.id}
            onClick={() => {
              respond({
                optionId: option.id,
                interactionId: request.interactionId,
              });
            }}
            type="button"
            variant={option.style === "danger" ? "outline" : "default"}
          >
            {option.label}
          </Button>
        ))}
      </div>
      {request.allowFreeform === true && (
        <form
          className="space-y-2"
          onSubmit={(event: { readonly preventDefault: () => void }) => {
            event.preventDefault();
            if (!disabled && text.trim()) {
              respond({
                interactionId: request.interactionId,
                text: text.trim(),
              });
            }
          }}
        >
          <Textarea
            aria-label="Your answer"
            disabled={disabled}
            maxLength={16_000}
            onChange={(event: {
              readonly target: { readonly value: string };
            }) => {
              setText(event.target.value);
            }}
            value={text}
          />
          <Button disabled={disabled || !text.trim()} type="submit">
            Submit answer
          </Button>
        </form>
      )}
    </div>
  );
};

const toolStatus = (
  part: Extract<ReadonlyEveMessagePart, { type: "tool" }>
): string => {
  if (part.state === "approval") {
    return "Waiting for input.";
  }
  if (part.state === "rejected") {
    return "Request declined.";
  }
  if (part.state === "failed") {
    return part.error?.message ?? "Tool failed";
  }
  if (part.state === "completed") {
    return "Tool completed.";
  }
  return "Working…";
};

const ToolFallback = ({
  part,
  disabled,
  respond,
}: {
  readonly part: Extract<ReadonlyEveMessagePart, { type: "tool" }>;
  readonly disabled: boolean;
  readonly respond: (response: Answer) => void;
}): React.JSX.Element => {
  const request = part.interaction
    ? {
        ...part.interaction.request,
        interactionId: part.interaction.interactionId,
      }
    : undefined;
  let content: React.ReactNode = (
    <p className="text-muted-foreground text-sm">{toolStatus(part)}</p>
  );
  if (part.interaction?.status === "open" && request) {
    content = (
      <PendingInput
        disabled={disabled}
        key={request.interactionId}
        request={request}
        respond={respond}
      />
    );
  } else if (part.state === "failed") {
    content = <ToolOutput errorText={part.error?.message ?? "Tool failed"} />;
  } else if (part.state === "completed" && part.output !== undefined) {
    content = <ToolOutput output={part.output} />;
  }
  return (
    <ToolActivity
      title={part.name}
      state={eveToolUIState(part.state)}
      defaultOpen
    >
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
  readonly respond: (response: Answer) => void;
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
  if (part.type === "interaction") {
    return part.status === "open" ? (
      <PendingInput
        request={{ ...part.request, interactionId: part.interactionId }}
        disabled={inputDisabled || isReadonly}
        respond={respond}
      />
    ) : null;
  }
  if (part.type !== "tool") {
    return <p>Unsupported content in this conversation.</p>;
  }
  if (part.state === "approval" || part.state === "blocked") {
    return (
      <ToolFallback
        part={part}
        disabled={inputDisabled || isReadonly}
        respond={respond}
      />
    );
  }
  if (getEveInstalledToolRenderer(`tool-${part.name}`)) {
    return (
      <EveToolResult
        isReadonly={isReadonly}
        messageId={messageId}
        part={part}
      />
    );
  }

  if (
    documentDefinitions.operations.has(part.name) ||
    part.name === "readDocument" ||
    (part.state === "completed" && isDocumentResult(part.output))
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
  if (parseToolId(part.name)) {
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
