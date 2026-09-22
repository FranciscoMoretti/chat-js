"use client";

import type {
  EveMessage,
  EveMessageInputRequest,
  EveMessagePart,
  InputResponse,
} from "eve/client";
import { useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { Message, MessageContent } from "@/components/ai-elements/message";
import { Response } from "@/components/ai-elements/response";
import { FollowUpSuggestionsView } from "@/components/followup-suggestions-view";
import { MessageActionsView } from "@/components/message-actions-view";
import { ReasoningPart } from "@/components/part/message-reasoning";
import { RetryButtonView } from "@/components/retry-button-view";
import { Tag } from "@/components/tag";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserMessageView } from "@/components/user-message-view";
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
  previewDocument = false,
}: {
  previewDocument?: boolean;
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
        preview={previewDocument}
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
// Parts remain EVE-owned; the message chrome is shared with the original runtime.
export const EveMessages = ({
  conversationId,
  messages,
  isReadonly,
  disabled,
  respond,
  onEdit,
  onRegenerate,
  onSuggestion,
  editor,
  renderVersions,
  renderResponses,
  modelForMessage,
  actionsDisabled = disabled,
  messageKey,
}: {
  conversationId?: string;
  messageKey?: (message: EveMessage) => string;
  messages: readonly EveMessage[];
  isReadonly: boolean;
  actionsDisabled?: boolean;
  onEdit?: (message: EveMessage) => void;
  onSuggestion?: (suggestion: string) => void;
  onRegenerate?: (message: EveMessage, response: EveMessage) => void;
  editor?: {
    messageId: string;
    content: ReactNode;
    onCancel: () => void;
    disabled: boolean;
  };
  renderResponses?: (message: EveMessage) => ReactNode;
  renderVersions?: (message: EveMessage, userMessage?: EveMessage) => ReactNode;
  modelForMessage?: (message: EveMessage) => string | undefined;
  disabled: boolean;
  respond: (response: InputResponse) => void;
}) => {
  const latestDocumentCallId = messages
    .flatMap((message) => message.parts)
    .filter((part) => part.type === "dynamic-tool")
    .findLast(
      (part) =>
        Object.hasOwn(eveDocumentOperations, part.toolName) ||
        part.toolName === "readDocument"
    )?.toolCallId;
  let precedingUser: EveMessage | undefined;
  // oxlint-disable-next-line eslint/complexity -- A row combines streamed content with its role-specific shared controls.
  return messages.map((message) => {
    const userMessage = precedingUser;
    if (message.role === "user") {
      precedingUser = message;
    }
    const editing = editor?.messageId === message.id ? editor : undefined;
    const canEdit =
      !isReadonly &&
      onEdit &&
      !actionsDisabled &&
      !editor &&
      eveUserForkBoundary(message);
    const text = message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n");
    const modelId = modelForMessage?.(message);
    const actions = (
      <MessageActionsView
        editDisabled={
          editing
            ? editing.disabled
            : actionsDisabled || !!editor || !eveUserForkBoundary(message)
        }
        isEditing={!!editing}
        isLoading={disabled && message.id === messages.at(-1)?.id && !editing}
        onCancelEdit={editing?.onCancel}
        onStartEdit={!isReadonly && onEdit ? () => onEdit(message) : undefined}
        role={message.role}
        siblings={renderVersions?.(message, userMessage)}
        onCopy={async () => {
          if (!text.trim()) {
            toast.error("There's no text to copy!");
            return;
          }
          try {
            await navigator.clipboard.writeText(text.trim());
            toast.success("Copied to clipboard!");
          } catch {
            toast.error("Unable to copy this message.");
          }
        }}
        feedback={
          message.role === "assistant" && !isReadonly ? (
            <>
              {conversationId && (
                <EveFeedbackActions
                  conversationId={conversationId}
                  disabled={disabled}
                  messageId={message.id}
                />
              )}
              {onRegenerate && (
                <RetryButtonView
                  disabled={
                    actionsDisabled ||
                    !!editor ||
                    !(message.metadata?.turnId || message.metadata?.modelId) ||
                    !(userMessage && eveUserForkBoundary(userMessage))
                  }
                  onRetry={() => {
                    if (userMessage) {
                      onRegenerate(userMessage, message);
                    }
                  }}
                />
              )}
              {modelId && (
                <div className="ml-2 flex items-center">
                  <Tag>{modelId}</Tag>
                </div>
              )}
            </>
          ) : undefined
        }
      />
    );
    if (message.role === "user") {
      return (
        <UserMessageView
          actions={actions}
          attachments={message.parts
            .filter((part) => part.type === "file")
            .map((part, index) => (
              // File parts retain their position in the streamed message.
              <EveAttachment key={`${message.id}:file:${index}`} part={part} />
            ))}
          editor={editing?.content}
          editDisabled={!canEdit}
          key={messageKey?.(message) ?? message.id}
          messageId={message.id}
          responses={renderResponses?.(message)}
          onEdit={!isReadonly && onEdit ? () => onEdit(message) : undefined}
          text={text}
        />
      );
    }
    return (
      <Message
        className="w-full max-w-full items-start py-1"
        data-message-id={message.id}
        from={message.role}
        key={messageKey?.(message) ?? message.id}
      >
        <MessageContent className="w-full px-0 py-0 text-left">
          <span className="sr-only">Assistant</span>
          {message.parts.map((part, index) => (
            <Part
              disabled={disabled}
              isReadonly={isReadonly}
              // Eve message parts are append-only; their index is their stable identity.
              key={`${message.id}:${index}`}
              messageId={message.id}
              part={part}
              respond={respond}
              previewDocument={
                part.type === "dynamic-tool" &&
                part.toolCallId === latestDocumentCallId
              }
            />
          ))}
          {actions}
          {message.id === messages.at(-1)?.id &&
            !isReadonly &&
            !actionsDisabled &&
            onSuggestion &&
            config.ai.tools.followupSuggestions.enabled && (
              <FollowUpSuggestionsView
                onSelect={onSuggestion}
                suggestions={messageFollowupSuggestions(message)}
              />
            )}
        </MessageContent>
      </Message>
    );
  });
};
