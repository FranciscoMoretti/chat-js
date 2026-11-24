"use client";

import { hasText } from "@/components/text-value";

import { interactions } from "eve/events";
import type { Answer, Interaction, SessionView } from "eve/events";
import React, { useMemo } from "react";
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

import { EveAttachment } from "../eve/eve-attachment";
import { EveMessageContent } from "../eve/eve-message-content";
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
    case "interaction": {
      return `interaction:${part.interactionId}`;
    }
    case "tool": {
      return `dynamic-tool:${part.callId}`;
    }
    default: {
      const unreachable: never = part;
      return unreachable;
    }
  }
};

interface ChatTranscriptProps {
  readonly branchId?: string;
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
  readonly view?: SessionView;
  readonly respond: (response: Answer) => void;
}

interface MessageRowProps extends Omit<
  ChatTranscriptProps,
  "messages" | "messageKey"
> {
  readonly message: ReadonlyEveMessage;
  readonly userMessage: ReadonlyEveMessage | undefined;
  readonly isLast: boolean;
  readonly actionsDisabled: boolean;
  readonly interactionsByCall: ReadonlyMap<string, readonly Interaction[]>;
}

const AssistantFeedback = ({
  message,
  userMessage,
  branchId,
  disabled,
  actionsDisabled,
  editor,
  onRegenerate,
  modelId,
}: Pick<
  MessageRowProps,
  | "message"
  | "userMessage"
  | "branchId"
  | "disabled"
  | "actionsDisabled"
  | "editor"
  | "onRegenerate"
> & { readonly modelId: string | undefined }): ReactJSX.Element => (
  <>
    {hasText(branchId) && (
      <MessageActions
        branchId={branchId}
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
  branchId,
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
  | "branchId"
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
            branchId={branchId}
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
  branchId,
  isReadonly,
  disabled,
  actionsDisabled,
  inputDisabled,
  view,
  interactionsByCall,
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
      branchId={branchId}
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
      <EveMessageContent
        inputDisabled={responseDisabled(isReadonly, disabled, inputDisabled)}
        interactionsByCall={interactionsByCall}
        isReadonly={isReadonly}
        messageId={message.id}
        parts={message.parts.map((part) => ({ key: nextPartKey(part), part }))}
        respond={respond}
        view={view}
      />
    </ChatMessageView>
  );
};

// Production and Create render the same EVE parts and installed tool surfaces.
export const ChatTranscript = ({
  messages,
  messageKey,
  disabled,
  actionsDisabled = disabled,
  view,
  ...props
}: ChatTranscriptProps): ReactJSX.Element[] => {
  const interactionsByCall = useMemo(() => {
    const byCall = new Map<string, Interaction[]>();
    if (view !== undefined) {
      for (const interaction of interactions(view)) {
        const callId = interaction.call?.callId;
        const { kind } = interaction.request;
        if (
          callId === undefined ||
          (kind !== "question" && kind !== "approval")
        ) {
          continue;
        }
        const entries = byCall.get(callId);
        if (entries) {
          entries.push(interaction);
        } else {
          byCall.set(callId, [interaction]);
        }
      }
    }
    return byCall;
  }, [view]);
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
        disabled={disabled}
        actionsDisabled={actionsDisabled}
        interactionsByCall={interactionsByCall}
        view={view}
      />
    </MessageScrollerItem>
  ));
};
