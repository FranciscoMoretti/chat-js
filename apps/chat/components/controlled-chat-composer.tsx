"use client";

import type { ComponentProps, JSX as ReactJSX } from "react";

import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";

import type { ChatStatus } from "ai";

import { LexicalChatInput } from "@/components/lexical-chat-input";

import React from "react";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";

import { useIsMobile } from "@/hooks/use-mobile";

const MAX_DRAFT_LENGTH = 16_000;

const ChatComposerFooter = ({
  tools,
  actions,
}: {
  readonly tools?: ReadonlyReactNode;
  readonly actions: ReadonlyReactNode;
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
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ControlledChatComposer); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-no-literals -- ControlledChatComposer renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */

/* oxlint-disable max-lines-per-function, react-perf/jsx-no-jsx-as-prop, react-perf/jsx-no-new-function-as-prop, react/no-multi-comp -- ControlledChatComposer: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react-perf/jsx-no-jsx-as-prop: this component composition slot accepts an element from the current render; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

/**
 * A controlled composer for runtimes that own their own submission lifecycle.
 *
 * @param {string} draft Current text controlled by the runtime.
 * @param {(draft: string) => void} onDraftChange Writes text changes back to the runtime.
 * @param {() => void} onSubmit Submits the current draft.
 * @param {boolean} disabled Disables editing and submission.
 * @param {ChatStatus | undefined} status Runtime-owned status value.
 * @param {(() => void) | undefined} onStop Cancels the active submission.
 * @param {boolean | undefined} stopDisabled Runtime-owned stopDisabled value.
 * @param {boolean | undefined} autoFocus Focuses the input on mount.
 * @param {ReadonlyReactNode | undefined} tools Tool controls in the footer.
 * @param {ReadonlyReactNode | undefined} attachments Current attached files.
 * @param {boolean | undefined} hasAttachments Runtime-owned hasAttachments value.
 * @param {boolean | undefined} readOnly Runtime-owned readOnly value.
 * @param {ComponentProps<typeof LexicalChatInput>["onPaste"] | undefined} onPaste Runtime-owned onPaste value.
 * @returns {React.JSX.Element} The composed message interface.
 */
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
  readonly attachments?: ReadonlyReactNode;
  readonly hasAttachments?: boolean;
  readonly readOnly?: boolean;
  readonly onPaste?: ComponentProps<typeof LexicalChatInput>["onPaste"];
  readonly draft: string;
  readonly onDraftChange: (draft: string) => void;
  readonly onSubmit: () => void;
  readonly disabled: boolean;
  readonly status?: ChatStatus;
  readonly onStop?: () => void;
  readonly stopDisabled?: boolean;
  readonly autoFocus?: boolean;
  readonly tools?: ReadonlyReactNode;
}): ReactJSX.Element => {
  const isMobile = useIsMobile();
  const busy = status === "submitted" || status === "streaming";
  const canSend =
    !disabled &&
    (Boolean(draft.trim()) || hasAttachments) &&
    draft.length <= MAX_DRAFT_LENGTH;
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
      onSubmit={(event: { readonly preventDefault: () => void }) => {
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
        onEnterSubmit={(
          event: Readonly<
            Pick<KeyboardEvent, "isComposing" | "ctrlKey" | "shiftKey">
          >
        ) => {
          if (
            event.isComposing ||
            // oxlint-disable-next-line no-ternary -- Keep negated operand as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
          // oxlint-disable-next-line no-ternary -- Keep placeholder JSX attribute as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          isMobile
            ? "Send a message... (Ctrl+Enter to send)"
            : "Send a message..."
        }
        readOnly={readOnly || (busy && !onStop)}
      />
      <ChatComposerFooter
        actions={
          <PromptInputSubmit
            // oxlint-disable-next-line no-ternary -- Keep aria-label JSX attribute as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
            aria-label={busy && onStop ? "Stop" : "Send"}
            // oxlint-disable-next-line react/forbid-component-props -- PromptInputSubmit accepts className in its styling contract; preserve this caller's layout and appearance.
            className="size-8 shrink-0 @[500px]:size-10"
            // oxlint-disable-next-line no-ternary -- Keep disabled JSX attribute as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
            disabled={busy && onStop ? stopDisabled : !canSend}
            onClick={(event: { readonly preventDefault: () => void }) => {
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
      {draft.length > MAX_DRAFT_LENGTH && (
        <p className="text-destructive px-3 text-sm" role="alert">
          Messages must be at most 16,000 characters.
        </p>
      )}
    </PromptInput>
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable max-lines-per-function, react-perf/jsx-no-jsx-as-prop, react-perf/jsx-no-new-function-as-prop, react/no-multi-comp */
