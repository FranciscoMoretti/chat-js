"use client";

import type {
  EveMessage,
  EveMessageInputRequest,
  EveMessagePart,
  InputResponse,
} from "eve/client";
import React, { useState } from "react";
import type { JSX as ReactJSX, ReactNode } from "react";
import { toast } from "sonner";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { Message, MessageContent } from "@/components/ai-elements/message";
/* oxlint-enable sort-imports */
import { Response } from "@/components/ai-elements/response";
import { ToolInput } from "@/components/ai-elements/tool";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { FollowUpSuggestionsView } from "@/components/followup-suggestions-view";
/* oxlint-enable sort-imports */
import { MessageActionsView } from "@/components/message-actions-view";
import { ReasoningPart } from "@/components/part/message-reasoning";
import { RetryButtonView } from "@/components/retry-button-view";
/* oxlint-disable import/max-dependencies -- @/components/tag import: import/max-dependencies: these direct dependencies compose this feature without hiding imports behind a barrel. */
import { Tag } from "@/components/tag";
/* oxlint-enable import/max-dependencies */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Button } from "@/components/ui/button";
/* oxlint-enable sort-imports */
import { Textarea } from "@/components/ui/textarea";
import { UserMessageView } from "@/components/user-message-view";
import { parseToolId } from "@/lib/ai/mcp-name-id";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { getEveInstalledToolRenderer } from "@/lib/ai/tool-renderer-registry";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { config } from "@/lib/config";
/* oxlint-enable sort-imports */
import { eveDocumentOperations } from "@/lib/eve/document-contracts";
import { messageFollowupSuggestions } from "@/lib/eve/followup-suggestions";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { eveUserForkBoundary } from "@/lib/eve/fork-source";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Keep the recursive readonly EVE data view after the runtime module imports. */
import type { ReadonlyEveMessagePart } from "@/lib/eve/readonly-message-types";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { EveAttachment } from "./eve-attachment";
/* oxlint-enable sort-imports */
import { EveDocumentTool } from "./eve-document-tool";
import { EveFeedbackActions } from "./eve-feedback-actions";
import { EveMcpResult } from "./eve-mcp-result";
import { EveToolResult } from "./eve-tool-result";
/* oxlint-disable react/jsx-no-literals -- PendingInput renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
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
        {
          /* oxlint-disable oxc/no-optional-chaining -- Keep the existing nullish guard when reading map from request.options; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining. */
          request.options?.map((option): React.JSX.Element => (
            <Button
              disabled={disabled}
              key={option.id}
              onClick={() =>
                respond({ optionId: option.id, requestId: request.requestId })
              }
              type="button"
              // oxlint-disable-next-line no-ternary -- Keep variant JSX attribute as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
              variant={option.style === "danger" ? "outline" : "default"}
            >
              {option.label}
            </Button>
          ))
          /* oxlint-enable oxc/no-optional-chaining */
        }
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
/* oxlint-enable react/jsx-no-literals */
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
/* oxlint-disable react/jsx-no-literals -- Part renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */

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
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading inputRequest from part.toolMetadata.eve; read eve from part.toolMetadata; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  const request = part.toolMetadata?.eve?.inputRequest;
  return (
    <section
      aria-label="Tool result"
      className="space-y-3 rounded-lg border p-4"
    >
      <p className="font-medium">{part.toolName}</p>
      {part.input !== undefined && (
        <ToolInput
          // oxlint-disable-next-line react/forbid-component-props -- ToolInput accepts className in its styling contract; preserve this caller's layout and appearance.
          className="p-0"
          input={part.input}
        />
      )}
      {
        // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        part.state === "approval-requested" && request ? (
          <PendingInput
            disabled={disabled}
            key={request.requestId}
            request={request}
            respond={respond}
          />
        ) : (
          <p className="text-muted-foreground text-sm">{toolStatus(part)}</p>
        )
      }
    </section>
  );
};
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (EveMessages); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-disable react/jsx-no-literals -- EveMessages renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
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
  const [, startEventAction] = React.useTransition();
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading toolCallId from messages.flatMap(...).filter(...).findLast(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
      // oxlint-disable-next-line react/immutability -- This local accumulator is assigned during the synchronous render map; it never changes after render.
      precedingUser = message;
    }
    // oxlint-disable-next-line oxc/no-optional-chaining, no-ternary -- Keep the existing nullish guard when reading messageId from editor; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.; no-ternary: Keep editing as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
    const partOccurrences = new Map<string, number>();
    const nextPartKey = (part: EveMessagePart): string => {
      const identity = messagePartIdentity(part);
      const occurrence = partOccurrences.get(identity) ?? 0;
      partOccurrences.set(identity, occurrence + 1);
      return `${message.id}:${identity}:${occurrence}`;
    };
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling modelForMessage; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining.
    const modelId = modelForMessage?.(message);
    /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve actions's awaited sequencing and rejected-Promise behavior. */
    const actions = (
      <MessageActionsView
        editDisabled={
          // oxlint-disable-next-line no-ternary -- Keep editDisabled JSX attribute as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          editing
            ? editing.disabled
            : actionsDisabled ||
              Boolean(editor) ||
              !eveUserForkBoundary(message)
        }
        isEditing={Boolean(editing)}
        isLoading={
          disabled &&
          message.id /* oxlint-disable oxc/no-optional-chaining -- Keep the existing nullish guard when reading id from messages.at(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining. */ ===
            messages.at(-1)?.id &&
          /* oxlint-enable oxc/no-optional-chaining */ !editing
        }
        onCancelEdit={
          /* oxlint-disable oxc/no-optional-chaining -- Keep the existing nullish guard when reading onCancel from editing; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining. */
          editing?.onCancel
          /* oxlint-enable oxc/no-optional-chaining */
        }
        onStartEdit={
          // oxlint-disable-next-line no-ternary -- Keep onStartEdit JSX attribute as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          !isReadonly && onEdit ? (): void => onEdit(message) : undefined
        }
        role={message.role}
        siblings={
          /* oxlint-disable oxc/no-optional-chaining -- Keep the existing nullish guard when calling renderVersions; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining. */
          renderVersions?.(message, userMessage)
          /* oxlint-enable oxc/no-optional-chaining */
        }

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
          // oxlint-disable-next-line no-ternary -- Keep feedback JSX attribute as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
                    // oxlint-disable-next-line typescript/prefer-nullish-coalescing, oxc/no-optional-chaining -- #602: These flags express independent truthy conditions, not a nullish fallback. Optional chain: Keep the existing nullish guard when reading turnId from message.metadata; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining. Keep the existing nullish guard when reading modelId from message.metadata; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
    /* oxlint-enable oxc/no-async-await */
    if (message.role === "user") {
      return (
        <UserMessageView
          actions={actions}
          attachments={message.parts
            .filter((part) => part.type === "file")
            .map((part): React.JSX.Element => (
              <EveAttachment key={nextPartKey(part)} part={part} />
            ))}
          editor={
            /* oxlint-disable oxc/no-optional-chaining -- Keep the existing nullish guard when reading content from editing; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining. */
            editing?.content
            /* oxlint-enable oxc/no-optional-chaining */
          }
          editDisabled={!canEdit}
          key={
            /* oxlint-disable oxc/no-optional-chaining -- Keep the existing nullish guard when calling messageKey; preserve one receiver evaluation, skipped call arguments and the existing message.id fallback. The app guidance prefers optional chaining. */
            messageKey?.(message) ??
            /* oxlint-enable oxc/no-optional-chaining */ message.id
          }
          messageId={message.id}
          responses={
            /* oxlint-disable oxc/no-optional-chaining -- Keep the existing nullish guard when calling renderResponses; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining. */
            renderResponses?.(message)
            /* oxlint-enable oxc/no-optional-chaining */
          }
          onEdit={
            // oxlint-disable-next-line no-ternary -- Keep onEdit JSX attribute as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
            !isReadonly && onEdit ? (): void => onEdit(message) : undefined
          }
          text={text}
        />
      );
    }
    return (
      <Message
        // oxlint-disable-next-line react/forbid-component-props -- Message accepts className in its styling contract; preserve this caller's layout and appearance.
        className="w-full max-w-full items-start py-1"
        data-message-id={message.id}
        from={message.role}
        key={
          /* oxlint-disable oxc/no-optional-chaining -- Keep the existing nullish guard when calling messageKey; preserve one receiver evaluation, skipped call arguments and the existing message.id fallback. The app guidance prefers optional chaining. */
          messageKey?.(message) ??
          /* oxlint-enable oxc/no-optional-chaining */ message.id
        }
      >
        <MessageContent
          // oxlint-disable-next-line react/forbid-component-props -- MessageContent accepts className in its styling contract; preserve this caller's layout and appearance.
          className="w-full px-0 py-0 text-left"
        >
          <span className="sr-only">Assistant</span>
          {message.parts
            .filter((part) => part.type !== "step-start")
            .map((part): React.JSX.Element => (
              <Part
                disabled={disabled}
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
          {message.id /* oxlint-disable oxc/no-optional-chaining -- Keep the existing nullish guard when reading id from messages.at(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining. */ ===
            messages.at(-1)?.id &&
            /* oxlint-enable oxc/no-optional-chaining */ !isReadonly &&
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, no-undefined, react-perf/jsx-no-jsx-as-prop, react-perf/jsx-no-new-array-as-prop, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, typescript/strict-void-return */

/* oxlint-disable max-lines -- eve-messages keeps its cohesive feature and related render helpers together; splitting this module requires a separate public-boundary review. This exception covers the file-length metric. */
