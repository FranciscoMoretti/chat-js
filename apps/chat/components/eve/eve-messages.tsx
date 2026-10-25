"use client";

import { hasText } from "@/components/text-value";

import type { EveMessageInputRequest, InputResponse } from "eve/client";
import React, { useState } from "react";
import type { JSX as ReactJSX, ReactNode } from "react";
import { toast } from "sonner";

import { Message, MessageContent } from "@/components/ai-elements/message";
import { Response } from "@/components/ai-elements/response";
import { ToolInput } from "@/components/ai-elements/tool";
import { MessageActionsView } from "@/components/message-actions-view";
import { ReasoningPart } from "@/components/part/message-reasoning";
import { RetryButtonView } from "@/components/retry-button-view";
import { Tag } from "@/components/tag";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserMessageView } from "@/components/user-message-view";
import { parseToolId } from "@/lib/ai/mcp-name-id";
import { getEveInstalledToolRenderer } from "@/lib/ai/tool-renderer-registry";
import { eveDocumentOperations } from "@/lib/eve/document-contracts";
import type {
  ReadonlyEveMessage,
  ReadonlyEveMessagePart,
} from "@/lib/eve/readonly-message-types";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";

import { EveAttachment } from "./eve-attachment";
import { EveDocumentTool } from "./eve-document-tool";
import { PluginMessageActions } from "@/components/plugin-chat-ui";
import { EveMcpResult } from "./eve-mcp-result";
import { EveToolResult } from "./eve-tool-result";

const PendingInput = ({
  request,
  disabled,
  respond,
}: {
  readonly request: EveMessageInputRequest;
  readonly disabled: boolean;
  readonly respond: (response: InputResponse) => void;
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
              respond({ optionId: option.id, requestId: request.requestId });
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
            if (text.trim()) {
              respond({ requestId: request.requestId, text: text.trim() });
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

const messagePartIdentity = (part: ReadonlyEveMessagePart): string => {
  switch (part.type) {
    case "text":
    case "reasoning": {
      return `${part.type}:${part.stepIndex ?? "unscoped"}`;
    }
    case "file": {
      if (typeof part.url === "string" && part.url !== "") {
        return `file:${part.stepIndex ?? "unscoped"}:${part.url}`;
      }
      return `file:${part.stepIndex ?? "unscoped"}:${part.filename ?? "unnamed"}:${part.mediaType}`;
    }
    case "step-start": {
      return "step-start";
    }
    case "authorization": {
      return `authorization:${part.turnId}:${part.stepIndex}:${part.name}`;
    }
    case "dynamic-tool": {
      return `dynamic-tool:${part.toolCallId}`;
    }
    default: {
      const unreachable: never = part;
      return unreachable;
    }
  }
};

// This renderer handles all streamed EVE part variants and their recovery states.

const Part = ({
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
  return (
    <section
      aria-label="Tool result"
      className="space-y-3 rounded-lg border p-4"
    >
      <p className="font-medium">{part.toolName}</p>
      {part.input !== undefined && (
        <ToolInput className="p-0" input={part.input} />
      )}
      {part.state === "approval-requested" && request ? (
        <PendingInput
          disabled={inputDisabled}
          key={request.requestId}
          request={request}
          respond={respond}
        />
      ) : (
        <p className="text-muted-foreground text-sm">{toolStatus(part)}</p>
      )}
    </section>
  );
};

interface EveMessagesProps {
  readonly conversationId?: string;
  readonly messageKey?: (message: ReadonlyEveMessage) => string;
  readonly messages: readonly ReadonlyEveMessage[];
  readonly isReadonly: boolean;
  readonly actionsDisabled?: boolean;
  readonly onEdit?: (message: ReadonlyEveMessage) => void;
  readonly suggestions?: ReadonlyReactNode;
  readonly onRegenerate?: (
    message: ReadonlyEveMessage,
    response: ReadonlyEveMessage
  ) => void;
  readonly editor?: {
    readonly messageId: string;
    readonly content: ReadonlyReactNode;
    readonly onCancel: () => void;
    readonly disabled: boolean;
  };
  readonly renderResponses?: (message: ReadonlyEveMessage) => ReactNode;
  readonly renderVersions?: (
    message: ReadonlyEveMessage,
    userMessage?: ReadonlyEveMessage
  ) => ReactNode;
  readonly modelForMessage?: (
    message: ReadonlyEveMessage
  ) => string | undefined;
  readonly disabled: boolean;
  readonly inputDisabled?: boolean;
  readonly respond: (response: InputResponse) => void;
}

interface MessageRowProps extends Omit<
  EveMessagesProps,
  "messages" | "messageKey"
> {
  readonly message: ReadonlyEveMessage;
  readonly userMessage: ReadonlyEveMessage | undefined;
  readonly isLast: boolean;
  readonly latestDocumentCallId: string | undefined;
  readonly actionsDisabled: boolean;
}

const AssistantFeedback = ({
  message,
  userMessage,
  conversationId,
  disabled,
  actionsDisabled,
  editor,
  onRegenerate,
  modelId,
}: Pick<
  MessageRowProps,
  | "message"
  | "userMessage"
  | "conversationId"
  | "disabled"
  | "actionsDisabled"
  | "editor"
  | "onRegenerate"
> & { readonly modelId: string | undefined }): ReactJSX.Element => (
  <>
    {hasText(conversationId) && (
      <PluginMessageActions
        conversationId={conversationId}
        disabled={disabled}
        messageId={message.id}
      />
    )}
    {onRegenerate && (
      <RetryButtonView
        disabled={
          actionsDisabled ||
          Boolean(editor) ||
          !(
            hasText(message.metadata?.turnId) ||
            hasText(message.metadata?.modelId)
          ) ||
          !(userMessage && hasText(userMessage.id))
        }
        onRetry={() => {
          if (userMessage) {
            onRegenerate(userMessage, message);
          }
        }}
      />
    )}
    {hasText(modelId) && (
      <div className="ml-2 flex items-center">
        <Tag>{modelId}</Tag>
      </div>
    )}
  </>
);

const EveMessageActions = ({
  message,
  userMessage,
  conversationId,
  isReadonly,
  disabled,
  actionsDisabled,
  editor,
  onEdit,
  onRegenerate,
  renderVersions,
  modelId,
  isLast,
  text,
}: Pick<
  MessageRowProps,
  | "message"
  | "userMessage"
  | "conversationId"
  | "isReadonly"
  | "disabled"
  | "actionsDisabled"
  | "editor"
  | "onEdit"
  | "onRegenerate"
  | "renderVersions"
  | "isLast"
> & {
  readonly modelId: string | undefined;
  readonly text: string;
}): ReactJSX.Element => {
  const [, startEventAction] = React.useTransition();
  const editing = editor?.messageId === message.id ? editor : undefined;
  return (
    <MessageActionsView
      editDisabled={
        editing
          ? editing.disabled
          : actionsDisabled || Boolean(editor) || !hasText(message.id)
      }
      isEditing={Boolean(editing)}
      isLoading={disabled && isLast && !editing}
      onCancelEdit={editing?.onCancel}
      onStartEdit={
        !isReadonly && onEdit
          ? (): void => {
              onEdit(message);
            }
          : undefined
      }
      role={message.role}
      siblings={renderVersions?.(message, userMessage)}
      onCopy={() => {
        startEventAction(async () => {
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
        });
      }}
      feedback={
        message.role === "assistant" && !isReadonly ? (
          <AssistantFeedback
            message={message}
            userMessage={userMessage}
            conversationId={conversationId}
            disabled={disabled}
            actionsDisabled={actionsDisabled}
            editor={editor}
            onRegenerate={onRegenerate}
            modelId={modelId}
          />
        ) : undefined
      }
    />
  );
};

const responseDisabled = (
  readonly: boolean,
  busy: boolean,
  override: boolean | undefined
): boolean => readonly || (override ?? busy);

const EveMessageRow = ({
  message,
  userMessage,
  isLast,
  latestDocumentCallId,
  conversationId,
  isReadonly,
  disabled,
  actionsDisabled,
  inputDisabled,
  respond,
  onEdit,
  onRegenerate,
  suggestions,
  editor,
  renderVersions,
  renderResponses,
  modelForMessage,
}: MessageRowProps): ReactJSX.Element => {
  const editing = editor?.messageId === message.id ? editor : undefined;
  const canEdit =
    !isReadonly &&
    onEdit !== undefined &&
    !actionsDisabled &&
    !editor &&
    hasText(message.id);
  const text = message.parts
    .filter((part: ReadonlyEveMessagePart) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
  const partOccurrences = new Map<string, number>();
  const nextPartKey = (part: ReadonlyEveMessagePart): string => {
    const identity = messagePartIdentity(part);
    const occurrence = partOccurrences.get(identity) ?? 0;
    partOccurrences.set(identity, occurrence + 1);
    return `${message.id}:${identity}:${occurrence}`;
  };
  const modelId = modelForMessage?.(message);
  const actions = (
    <EveMessageActions
      message={message}
      userMessage={userMessage}
      conversationId={conversationId}
      isReadonly={isReadonly}
      disabled={disabled}
      actionsDisabled={actionsDisabled}
      editor={editor}
      onEdit={onEdit}
      onRegenerate={onRegenerate}
      renderVersions={renderVersions}
      modelId={modelId}
      isLast={isLast}
      text={text}
    />
  );
  if (message.role === "user") {
    return (
      <UserMessageView
        actions={actions}
        attachments={message.parts
          .filter((part: ReadonlyEveMessagePart) => part.type === "file")
          .map((part): React.JSX.Element => (
            <EveAttachment key={nextPartKey(part)} part={part} />
          ))}
        editor={editing?.content}
        editDisabled={!canEdit}
        messageId={message.id}
        responses={renderResponses?.(message)}
        onEdit={
          !isReadonly && onEdit
            ? (): void => {
                onEdit(message);
              }
            : undefined
        }
        text={text}
      />
    );
  }
  return (
    <Message
      className="w-full max-w-full items-start py-1"
      data-message-id={message.id}
      from={message.role}
    >
      <MessageContent className="w-full px-0 py-0 text-left">
        <span className="sr-only">Assistant</span>
        {message.parts
          .filter((part: ReadonlyEveMessagePart) => part.type !== "step-start")
          .map((part): React.JSX.Element => (
            <Part
              inputDisabled={responseDisabled(
                isReadonly,
                disabled,
                inputDisabled
              )}
              isReadonly={isReadonly}
              key={nextPartKey(part)}
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
        {isLast && !isReadonly && !actionsDisabled && suggestions}
      </MessageContent>
    </Message>
  );
};

// Parts remain EVE-owned; the message chrome is shared with the original runtime.
export const EveMessages = ({
  messages,
  messageKey,
  disabled,
  actionsDisabled = disabled,
  ...props
}: EveMessagesProps): ReactJSX.Element[] => {
  const latestDocumentCallId = messages
    .flatMap(
      (message: Readonly<{ parts: readonly ReadonlyEveMessagePart[] }>) =>
        message.parts
    )
    .filter((part: ReadonlyEveMessagePart) => part.type === "dynamic-tool")
    .findLast(
      (part) =>
        Object.hasOwn(eveDocumentOperations, part.toolName) ||
        part.toolName === "readDocument"
    )?.toolCallId;
  const precedingUsers: (ReadonlyEveMessage | undefined)[] = [];
  let precedingUser: ReadonlyEveMessage | undefined;
  for (const message of messages) {
    precedingUsers.push(precedingUser);
    if (message.role === "user") {
      precedingUser = message;
    }
  }
  return messages.map((message, index) => (
    <EveMessageRow
      {...props}
      key={messageKey?.(message) ?? message.id}
      message={message}
      userMessage={precedingUsers[index]}
      isLast={message.id === messages.at(-1)?.id}
      latestDocumentCallId={latestDocumentCallId}
      disabled={disabled}
      actionsDisabled={actionsDisabled}
    />
  ));
};
