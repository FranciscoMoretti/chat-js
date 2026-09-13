"use client";

import type {
  EveMessage,
  EveMessageInputRequest,
  EveMessagePart,
  InputResponse,
} from "eve/client";
import { Copy, Pencil, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
} from "@/components/ai-elements/message";
import { Response } from "@/components/ai-elements/response";
import { FollowUpSuggestionsView } from "@/components/followup-suggestions-view";
import { ReasoningPart } from "@/components/part/message-reasoning";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { parseToolId } from "@/lib/ai/mcp-name-id";
import { getEveInstalledToolRenderer } from "@/lib/ai/tool-renderer-registry";
import { config } from "@/lib/config";
import { noteInput, noteOutput } from "@/lib/eve/contracts";
import { eveDocumentOperations } from "@/lib/eve/document-contracts";
import { messageFollowupSuggestions } from "@/lib/eve/followup-suggestions";
import { eveUserForkBoundary } from "@/lib/eve/fork-source";
import { isEvePlatformTool } from "@/lib/eve/platform-result";

import { EveAttachment } from "./eve-attachment";
import { EveDocumentTool } from "./eve-document-tool";
import { EveFeedbackActions } from "./eve-feedback-actions";
import { EveMcpResult } from "./eve-mcp-result";
import { EvePlatformToolResult } from "./eve-platform-tool-result";
import { EveToolResult } from "./eve-tool-result";

const PendingInput = ({
  request,
  disabled,
  respond,
  prompt,
}: {
  request: EveMessageInputRequest;
  disabled: boolean;
  respond: (response: InputResponse) => void;
  prompt?: string;
}) => {
  const [text, setText] = useState("");
  return (
    <div className="space-y-3">
      <p>{prompt ?? request.prompt}</p>
      <div className="flex flex-wrap gap-2">
        {request.options?.map((option) => (
          <Button
            disabled={disabled}
            key={option.id}
            onClick={() =>
              respond({ optionId: option.id, requestId: request.requestId })
            }
            type="button"
            variant={option.style === "danger" ? "outline" : "default"}
          >
            {option.label}
          </Button>
        ))}
      </div>
      {request.allowFreeform && (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (text.trim()) {
              respond({ requestId: request.requestId, text: text.trim() });
            }
          }}
        >
          <Textarea
            aria-label="Your answer"
            disabled={disabled}
            maxLength={16_000}
            onChange={(event) => setText(event.target.value)}
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
  part: Extract<EveMessagePart, { type: "dynamic-tool" }>,
  confirmed: boolean
) => {
  if (confirmed) {
    return "Note confirmed.";
  }
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

// This renderer handles all streamed EVE part variants and their recovery states.
// oxlint-disable-next-line eslint/complexity
const Part = ({
  messageId,
  isReadonly,
  part,
  disabled,
  respond,
}: {
  messageId: string;
  isReadonly: boolean;
  part: EveMessagePart;
  disabled: boolean;
  respond: (response: InputResponse) => void;
}) => {
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
    getEveInstalledToolRenderer(`tool-${part.toolName}`) &&
    part.state !== "approval-requested" &&
    part.state !== "approval-responded"
  ) {
    return (
      <EveToolResult
        isReadonly={isReadonly}
        messageId={messageId}
        part={part}
      />
    );
  }
  if (isEvePlatformTool(part.toolName)) {
    return (
      <EvePlatformToolResult
        isReadonly={isReadonly}
        messageId={messageId}
        part={part}
      />
    );
  }
  if (
    Object.hasOwn(eveDocumentOperations, part.toolName) ||
    part.toolName === "readDocument"
  ) {
    return (
      <EveDocumentTool
        isReadonly={isReadonly}
        messageId={messageId}
        part={part}
      />
    );
  }
  if (
    parseToolId(part.toolName) &&
    part.state !== "approval-requested" &&
    part.state !== "approval-responded"
  ) {
    return <EveMcpResult part={part} />;
  }
  const request = part.toolMetadata?.eve?.inputRequest;
  const input = noteInput.safeParse(part.input);
  const output =
    part.state === "output-available"
      ? noteOutput.safeParse(part.output)
      : null;
  return (
    <section
      aria-label="Tool result"
      className="space-y-3 rounded-lg border p-4"
    >
      <p className="font-medium">
        {part.toolName === "confirm_note" ? "Confirm note" : "Agent request"}
      </p>
      {input.success && <p>{input.data.note}</p>}
      {part.state === "approval-requested" && request ? (
        <PendingInput
          disabled={disabled}
          key={request.requestId}
          prompt={
            part.toolName === "confirm_note" ? "Confirm this note?" : undefined
          }
          request={request}
          respond={respond}
        />
      ) : (
        <p className="text-muted-foreground text-sm">
          {toolStatus(part, output?.success === true)}
        </p>
      )}
    </section>
  );
};
// This renderer coordinates transcript grouping, actions, and streamed tool states.
// oxlint-disable-next-line eslint/complexity
export const EveMessages = ({
  conversationId,
  messages,
  isReadonly,
  disabled,
  respond,
  onEdit,
  onRegenerate,
  onSuggestion,
  actionsDisabled = disabled,
}: {
  conversationId?: string;
  messages: readonly EveMessage[];
  isReadonly: boolean;
  actionsDisabled?: boolean;
  onEdit?: (message: EveMessage) => void;
  onSuggestion?: (suggestion: string) => void;
  onRegenerate?: (message: EveMessage, response: EveMessage) => void;
  disabled: boolean;
  respond: (response: InputResponse) => void;
}) => {
  let precedingUser: EveMessage | undefined;
  // oxlint-disable-next-line eslint/complexity -- A transcript row renders all message actions and streamed content states together.
  return messages.map((message) => {
    const userMessage = precedingUser;
    if (message.role === "user") {
      precedingUser = message;
    }
    return (
      <Message className="flex-col" from={message.role} key={message.id}>
        <MessageContent className="max-w-full min-w-0">
          <span className="sr-only">
            {message.role === "user" ? "You" : "Assistant"}
          </span>
          {message.parts.map((part, index) => (
            <Part
              disabled={disabled}
              isReadonly={isReadonly}
              // Eve message parts are append-only; their index is their stable identity.
              // biome-ignore lint/suspicious/noArrayIndexKey: Eve parts have no IDs and retain their order during streaming.
              key={`${message.id}:${index}`}
              messageId={message.id}
              part={part}
              respond={respond}
            />
          ))}
        </MessageContent>
        <MessageActions
          className={message.role === "user" ? "justify-end" : ""}
        >
          {message.role === "user" && onEdit && (
            <MessageAction
              disabled={actionsDisabled || !eveUserForkBoundary(message)}
              onClick={() => onEdit(message)}
              tooltip="Edit message"
            >
              <Pencil size={14} />
            </MessageAction>
          )}
          {message.role === "assistant" && onRegenerate && (
            <MessageAction
              disabled={
                actionsDisabled ||
                !(message.metadata?.turnId || message.metadata?.modelId) ||
                !(userMessage && eveUserForkBoundary(userMessage))
              }
              onClick={() => {
                if (userMessage) {
                  onRegenerate(userMessage, message);
                }
              }}
              tooltip="Regenerate response"
            >
              <RotateCcw size={14} />
            </MessageAction>
          )}
          {conversationId && !isReadonly && message.role === "assistant" && (
            <EveFeedbackActions
              conversationId={conversationId}
              disabled={disabled}
              messageId={message.id}
            />
          )}
          <MessageAction
            onClick={async () => {
              const text = message.parts
                .filter((part) => part.type === "text")
                .map((part) => part.text)
                .join("\n");
              try {
                await navigator.clipboard.writeText(text);
                toast.success("Copied to clipboard!");
              } catch {
                toast.error("Unable to copy this message.");
              }
            }}
            tooltip="Copy"
          >
            <Copy size={14} />
          </MessageAction>
        </MessageActions>
        {message.role === "assistant" &&
          message.id === messages.at(-1)?.id &&
          !isReadonly &&
          !actionsDisabled &&
          onSuggestion &&
          config.ai.tools.followupSuggestions.enabled && (
            <FollowUpSuggestionsView
              onSelect={onSuggestion}
              suggestions={messageFollowupSuggestions(message)}
            />
          )}
      </Message>
    );
  });
};
