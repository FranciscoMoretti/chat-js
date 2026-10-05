"use client";

import type {
  EveMessage,
  EveMessageInputRequest,
  EveMessagePart,
  InputResponse,
} from "eve/client";
import type { JSX as ReactJSX, ReactNode } from "react";
import React, { useState } from "react";
import { toast } from "sonner";

import { Message, MessageContent } from "@/components/ai-elements/message";
import { Response } from "@/components/ai-elements/response";
import { ToolInput } from "@/components/ai-elements/tool";
import { FollowUpSuggestionsView } from "@/components/followup-suggestions-view";
import { MessageActionsView } from "@/components/message-actions-view";
import { ReasoningPart } from "@/components/part/message-reasoning";
import { RetryButtonView } from "@/components/retry-button-view";
/* oxlint-disable import/max-dependencies -- @/components/tag import: import/max-dependencies: these direct dependencies compose this feature without hiding imports behind a barrel. */
import { Tag } from "@/components/tag";
/* oxlint-enable import/max-dependencies */
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserMessageView } from "@/components/user-message-view";
import { parseToolId } from "@/lib/ai/mcp-name-id";
import { getEveInstalledToolRenderer } from "@/lib/ai/tool-renderer-registry";
import { config } from "@/lib/config";
import { eveDocumentOperations } from "@/lib/eve/document-contracts";
import { messageFollowupSuggestions } from "@/lib/eve/followup-suggestions";
import { eveUserForkBoundary } from "@/lib/eve/fork-source";

import { EveAttachment } from "./eve-attachment";
import { EveDocumentTool } from "./eve-document-tool";
import { EveFeedbackActions } from "./eve-feedback-actions";
import { EveMcpResult } from "./eve-mcp-result";
import { EveToolResult } from "./eve-tool-result";
/* oxlint-disable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- PendingInput: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including event); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including request.allowFreeform). */

const PendingInput = ({
  request,
  disabled,
  respond,
}: {
  request: EveMessageInputRequest;
  disabled: boolean;
  respond: (response: InputResponse) => void;
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
/* oxlint-enable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

const toolStatus = (
  part: Extract<EveMessagePart, { type: "dynamic-tool" }>
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

/* oxlint-disable max-lines-per-function, max-statements, no-undefined, react/no-multi-comp, typescript/prefer-readonly-parameter-types, unicorn/no-null -- Part: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

// This renderer handles all streamed EVE part variants and their recovery states.

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
          disabled={disabled}
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
/* oxlint-enable max-lines-per-function, max-statements, no-undefined, react/no-multi-comp, typescript/prefer-readonly-parameter-types, unicorn/no-null */
/* oxlint-disable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, no-undefined, react-perf/jsx-no-jsx-as-prop, react-perf/jsx-no-new-array-as-prop, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, typescript/strict-void-return -- EveMessages: ; init-declarations: branches initialize this value before use; an eager undefined initializer adds a second missing-value state; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including -1); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react-perf/jsx-no-jsx-as-prop: this component composition slot accepts an element from the current render; react-perf/jsx-no-new-array-as-prop: these props derive from the current render; sharing or memoizing them requires a separate identity contract; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including message: EveMessage); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including eveUserForkBoundary(message)); typescript/strict-void-return: this library event API ignores the return value while the existing handler owns its async pending and error lifecycle. */

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
            : actionsDisabled ||
              Boolean(editor) ||
              !eveUserForkBoundary(message)
        }
        isEditing={Boolean(editing)}
        isLoading={disabled && message.id === messages.at(-1)?.id && !editing}
        onCancelEdit={editing?.onCancel}
        onStartEdit={
          !isReadonly && onEdit ? (): void => onEdit(message) : undefined
        }
        role={message.role}
        siblings={renderVersions?.(message, userMessage)}

        // oxlint-disable-next-line typescript/no-misused-promises -- #585: Message copy manages clipboard failures and feedback within the async handler.
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
                    Boolean(editor) ||
                    // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: These flags express independent truthy conditions, not a nullish fallback.
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
            .map((part, index): React.JSX.Element => (
              // oxlint-disable-next-line react/no-array-index-key -- #551: File parts retain their position in the streamed message.
              <EveAttachment key={`${message.id}:file:${index}`} part={part} />
            ))}
          editor={editing?.content}
          editDisabled={!canEdit}
          key={messageKey?.(message) ?? message.id}
          messageId={message.id}
          responses={renderResponses?.(message)}
          onEdit={
            !isReadonly && onEdit ? (): void => onEdit(message) : undefined
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
        key={messageKey?.(message) ?? message.id}
      >
        <MessageContent className="w-full px-0 py-0 text-left">
          <span className="sr-only">Assistant</span>
          {message.parts.map((part, index): React.JSX.Element => (
            <Part
              disabled={disabled}
              isReadonly={isReadonly}
              // oxlint-disable-next-line react/no-array-index-key -- #551: EVE message parts are append-only; their index is their stable identity.
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
/* oxlint-enable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, no-undefined, react-perf/jsx-no-jsx-as-prop, react-perf/jsx-no-new-array-as-prop, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, typescript/strict-void-return */

/* oxlint-disable max-lines -- eve-messages keeps its cohesive feature and related render helpers together; splitting this module requires a separate public-boundary review. This exception covers the file-length metric. */
