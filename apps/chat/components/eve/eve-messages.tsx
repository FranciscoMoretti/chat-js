"use client";

import { isDocumentResult } from "@/lib/eve/document-contracts";

import { hasText } from "@/components/text-value";

import type { InputResponse } from "eve/client";
import React from "react";
import type { JSX as ReactJSX, ReactNode } from "react";
import { toast } from "sonner";

import { Message, MessageContent } from "@/components/ui/message";
import { ChatMessageView } from "../chat-message-view";
import { MessageScrollerItem } from "@/components/ui/message-scroller";
import { MessageActionsView } from "@/components/message-actions-view";
import { RetryButtonView } from "@/components/retry-button-view";
import { Tag } from "@/components/tag";
import { UserMessageView } from "@/components/user-message-view";
import type {
  ReadonlyEveMessage,
  ReadonlyEveMessagePart,
} from "@/lib/eve/readonly-message-types";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";

import { EveAttachment } from "./eve-attachment";
import { documentDefinitions } from "@/integrations/documents";
import { EveMessagePart } from "./eve-message-part";
import { MessageActions } from "@/components/chat-slots";

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
      <MessageActions
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
    <ChatMessageView
      messageId={message.id}
      author={message.role}
      primitives={{ Message, MessageContent }}
      actions={actions}
      followUp={isLast && !isReadonly && !actionsDisabled && suggestions}
    >
      {message.parts
        .filter((part: ReadonlyEveMessagePart) => part.type !== "step-start")
        .map((part): React.JSX.Element => (
          <EveMessagePart
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
    </ChatMessageView>
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
        documentDefinitions.operations.has(part.toolName) ||
        part.toolName === "readDocument" ||
        (part.state === "output-available" && isDocumentResult(part.output))
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
    <MessageScrollerItem
      key={messageKey?.(message) ?? message.id}
      messageId={messageKey?.(message) ?? message.id}
      scrollAnchor={message.role === "user"}
    >
      <EveMessageRow
        {...props}
        message={message}
        userMessage={precedingUsers[index]}
        isLast={message.id === messages.at(-1)?.id}
        latestDocumentCallId={latestDocumentCallId}
        disabled={disabled}
        actionsDisabled={actionsDisabled}
      />
    </MessageScrollerItem>
  ));
};
