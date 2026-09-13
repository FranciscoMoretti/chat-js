"use client";

import { type ComponentProps, memo, type ReactNode } from "react";

import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { ConnectorsDropdown } from "@/components/connectors-dropdown";
import { LexicalChatInput } from "@/components/lexical-chat-input";
import {
  ComposerAttachButton,
  ComposerAttachments,
  ComposerContextUsage,
  ComposerInput,
  ComposerLimits,
  ComposerModelPicker,
  ComposerSubmit,
  ComposerTools,
  MultimodalInput,
} from "@/components/multimodal-input";
import { useIsMobile } from "@/hooks/use-mobile";

/** The reference app's composer. Add, remove or reorder controls here. */
export const ChatComposer = memo(function ChatComposer(
  props: Omit<ComponentProps<typeof MultimodalInput>, "children">
) {
  return (
    <MultimodalInput {...props}>
      <ComposerLimits />
      <ComposerAttachments />
      <ComposerInput />
      <ChatComposerFooter
        actions={
          <>
            <ComposerContextUsage />
            <ComposerSubmit />
          </>
        }
        tools={
          <>
            <ComposerAttachButton />
            <ComposerModelPicker />
            <ConnectorsDropdown />
            <ComposerTools />
          </>
        }
      />
    </MultimodalInput>
  );
});

/** Shared composer chrome; runtime controllers supply only supported actions. */
function ChatComposerFooter({
  tools,
  actions,
}: {
  tools?: ReactNode;
  actions: ReactNode;
}) {
  return (
    <PromptInputFooter className="flex w-full min-w-0 flex-row items-center justify-between gap-1 border-t px-1 py-1 group-has-[>input]/input-group:pb-1 @[500px]:gap-2 [.border-t]:pt-1">
      <PromptInputTools className="flex min-w-0 items-center gap-1 @[500px]:gap-2">
        {tools}
      </PromptInputTools>
      <div className="flex items-center gap-1">{actions}</div>
    </PromptInputFooter>
  );
}

/** A controlled composer for runtimes that own their own submission lifecycle. */
export function ControlledChatComposer({
  draft,
  onDraftChange,
  onSubmit,
  disabled,
  busy = false,
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
  busy?: boolean;
  onStop?: () => void;
  stopDisabled?: boolean;
  autoFocus?: boolean;
  tools?: ReactNode;
}) {
  const isMobile = useIsMobile();
  const activeStatus = onStop ? "streaming" : "submitted";
  const canSend =
    !disabled &&
    (Boolean(draft.trim()) || hasAttachments) &&
    draft.length <= 16_000;
  function submit() {
    if (canSend) {
      onSubmit();
    }
  }
  return (
    <PromptInput
      className="@container relative transition-colors"
      inputGroupClassName="bg-muted dark:bg-muted"
      onSubmit={(_message, event) => {
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
            status={busy ? activeStatus : "ready"}
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
}
