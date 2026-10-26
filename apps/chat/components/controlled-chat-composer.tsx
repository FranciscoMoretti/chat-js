"use client";

import type { ComponentProps, JSX as ReactJSX } from "react";

import { PromptForm } from "@/components/composer/prompt-form";
import { InputGroupButton } from "@/components/ui/input-group";
import { ArrowUpIcon, Loader2Icon, SquareIcon } from "lucide-react";

import type { ChatStatus } from "ai";

import { LexicalChatInput } from "@/components/lexical-chat-input";

import React from "react";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";

import { useIsMobile } from "@/hooks/use-mobile";

const MAX_DRAFT_LENGTH = 16_000;

const ComposerAction = ({
  status,
  onStop,
  stopDisabled,
  canSend,
}: {
  readonly status: ChatStatus;
  readonly onStop?: () => void;
  readonly stopDisabled: boolean;
  readonly canSend: boolean;
}): React.JSX.Element => {
  const stopping =
    (status === "submitted" || status === "streaming") && Boolean(onStop);
  let icon = <ArrowUpIcon />;
  if (status === "submitted") {
    icon = <Loader2Icon className="animate-spin" />;
  } else if (stopping) {
    icon = <SquareIcon />;
  }
  return (
    <InputGroupButton
      aria-label={stopping ? "Stop" : "Send"}
      size="icon-sm"
      variant={stopping ? "outline" : "default"}
      type={stopping ? "button" : "submit"}
      disabled={stopping ? stopDisabled : !canSend}
      onClick={stopping ? onStop : undefined}
    >
      {icon}
    </InputGroupButton>
  );
};

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
  const editorReadOnly = readOnly || (busy && !onStop);
  const canSend =
    !disabled &&
    !editorReadOnly &&
    !busy &&
    (Boolean(draft.trim()) || hasAttachments) &&
    draft.length <= MAX_DRAFT_LENGTH;
  const submit = (): void => {
    if (canSend) {
      onSubmit();
    }
  };
  return (
    <PromptForm
      editable={!disabled && !editorReadOnly}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      attachments={attachments}
      tools={tools}
      actions={
        <ComposerAction
          status={status}
          onStop={onStop}
          stopDisabled={stopDisabled}
          canSend={canSend}
        />
      }
      message={
        draft.length > MAX_DRAFT_LENGTH ? (
          <p className="text-destructive px-3 text-sm" role="alert">
            Messages must be at most 16,000 characters.
          </p>
        ) : undefined
      }
    >
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
        readOnly={editorReadOnly}
      />
    </PromptForm>
  );
};
