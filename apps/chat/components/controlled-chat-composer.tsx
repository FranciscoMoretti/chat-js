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
  <PromptInputFooter className="flex w-full min-w-0 flex-row items-center justify-between gap-1 border-t px-1 py-1 group-has-[>input]/input-group:pb-1 @[500px]:gap-2 [.border-t]:pt-1">
    <PromptInputTools className="flex min-w-0 items-center gap-1 @[500px]:gap-2">
      {tools}
    </PromptInputTools>
    <div className="flex items-center gap-1">{actions}</div>
  </PromptInputFooter>
);

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
        autoFocus={autoFocus}
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
            className="size-8 shrink-0 @[500px]:size-10"
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
