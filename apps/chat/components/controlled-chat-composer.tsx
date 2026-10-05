"use client";

import type { ChatStatus } from "ai";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ComponentProps, JSX as ReactJSX, ReactNode } from "react";
/* oxlint-enable sort-imports */
import React from "react";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
/* oxlint-enable sort-imports */
import { LexicalChatInput } from "@/components/lexical-chat-input";
import { useIsMobile } from "@/hooks/use-mobile";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- ChatComposerFooter: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const ChatComposerFooter = ({
  tools,
  actions,
}: {
  tools?: ReactNode;
  actions: ReactNode;
}): React.JSX.Element => (
  <PromptInputFooter
    // oxlint-disable-next-line react/forbid-component-props -- PromptInputFooter accepts className in its styling contract; preserve this caller's layout and appearance.
    className="flex w-full min-w-0 flex-row items-center justify-between gap-1 border-t px-1 py-1 group-has-[>input]/input-group:pb-1 @[500px]:gap-2 [.border-t]:pt-1"
  >
    <PromptInputTools
      // oxlint-disable-next-line react/forbid-component-props -- PromptInputTools accepts className in its styling contract; preserve this caller's layout and appearance.
      className="flex min-w-0 items-center gap-1 @[500px]:gap-2"
    >
      {tools}
    </PromptInputTools>
    <div className="flex items-center gap-1">{actions}</div>
  </PromptInputFooter>
);
/* oxlint-disable react/jsx-no-literals -- ControlledChatComposer renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, no-magic-numbers, react-perf/jsx-no-jsx-as-prop, react-perf/jsx-no-new-function-as-prop, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- ControlledChatComposer: ; jsdoc/require-param: the TypeScript signature describes these parameters; the prose documents behavior rather than duplicate tags; jsdoc/require-returns: the inferred or annotated return type describes the value; the prose documents behavior rather than duplicate tags; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 16_000); react-perf/jsx-no-jsx-as-prop: this component composition slot accepts an element from the current render; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including event). */

/** A controlled composer for runtimes that own their own submission lifecycle. */
export const ControlledChatComposer = ({
  draft,
  onDraftChange,
  onSubmit,
  disabled,
  status = "ready",
  onStop,
  stopDisabled = false,
  autoFocus = false,
  tools,
  attachments,
  hasAttachments = false,
  readOnly = false,
  onPaste,
}: {
  attachments?: ReactNode;
  hasAttachments?: boolean;
  readOnly?: boolean;
  onPaste?: ComponentProps<typeof LexicalChatInput>["onPaste"];
  draft: string;
  onDraftChange: (draft: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  status?: ChatStatus;
  onStop?: () => void;
  stopDisabled?: boolean;
  autoFocus?: boolean;
  tools?: ReactNode;
}): ReactJSX.Element => {
  const isMobile = useIsMobile();
  const busy = status === "submitted" || status === "streaming";
  const canSend =
    !disabled &&
    (Boolean(draft.trim()) || hasAttachments) &&
    draft.length <= 16_000;
  const submit = (): void => {
    if (canSend) {
      onSubmit();
    }
  };
  return (
    <PromptInput
      // oxlint-disable-next-line react/forbid-component-props -- PromptInput accepts className in its styling contract; preserve this caller's layout and appearance.
      className="@container relative transition-colors"
      inputGroupClassName="bg-muted dark:bg-muted"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {attachments}
      <LexicalChatInput
        aria-label="Message"
        // oxlint-disable-next-line jsx-a11y/no-autofocus -- #536: The caller owns initial focus; this shared composer defaults autoFocus to false.
        autoFocus={autoFocus}
        // oxlint-disable-next-line react/forbid-component-props -- LexicalChatInput accepts className in its styling contract; preserve this caller's layout and appearance.
        className="max-h-[max(35svh,5rem)] min-h-[60px] overflow-y-scroll sm:min-h-[80px]"
        data-testid="multimodal-input"
        initialValue={draft}
        onEnterSubmit={(event) => {
          if (
            event.isComposing ||
            !(isMobile ? event.ctrlKey : !event.shiftKey)
          ) {
            return false;
          }
          submit();
          return true;
        }}
        onInputChange={onDraftChange}
        onPaste={onPaste}
        placeholder={
          isMobile
            ? "Send a message... (Ctrl+Enter to send)"
            : "Send a message..."
        }
        readOnly={readOnly || (busy && !onStop)}
      />
      <ChatComposerFooter
        actions={
          <PromptInputSubmit
            aria-label={busy && onStop ? "Stop" : "Send"}
            // oxlint-disable-next-line react/forbid-component-props -- PromptInputSubmit accepts className in its styling contract; preserve this caller's layout and appearance.
            className="size-8 shrink-0 @[500px]:size-10"
            disabled={busy && onStop ? stopDisabled : !canSend}
            onClick={(event) => {
              event.preventDefault();
              if (busy && onStop) {
                onStop();
              } else {
                submit();
              }
            }}
            status={status}
          />
        }
        tools={tools}
      />
      {draft.length > 16_000 && (
        <p className="text-destructive px-3 text-sm" role="alert">
          Messages must be at most 16,000 characters.
        </p>
      )}
    </PromptInput>
  );
};
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, no-magic-numbers, react-perf/jsx-no-jsx-as-prop, react-perf/jsx-no-new-function-as-prop, react/no-multi-comp, typescript/prefer-readonly-parameter-types */
