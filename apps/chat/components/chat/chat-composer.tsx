"use client";

import type { ComponentProps, JSX as ReactJSX } from "react";

import { PromptForm } from "../composer/prompt-form";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { ArrowUpIcon, Loader2Icon, SquareIcon } from "lucide-react";

import type { ChatStatus } from "ai";

import { useAutoFocus } from "@/hooks/use-auto-focus";
import { useMounted } from "@/hooks/use-mounted";

import React, { useLayoutEffect } from "react";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";

import { useIsMobile } from "@/hooks/use-mobile";

const MAX_DRAFT_LENGTH = 16_000;

const defaultPrimitives = { InputGroup, InputGroupAddon, InputGroupButton };
type ComposerPrimitives = NonNullable<
  ComponentProps<typeof PromptForm>["primitives"]
> & {
  InputGroupButton: React.ComponentType<
    ComponentProps<"button"> & {
      size: "icon-sm";
      variant: "outline" | "default";
    }
  >;
};

const ComposerAction = ({
  status,
  onStop,
  stopDisabled,
  canSend,
  primitives,
  sendIcon,
}: {
  readonly status: ChatStatus;
  readonly onStop?: () => void;
  readonly stopDisabled: boolean;
  readonly canSend: boolean;
  readonly primitives: ComposerPrimitives;
  readonly sendIcon?: ReadonlyReactNode;
}): React.JSX.Element => {
  const stopping =
    (status === "submitted" || status === "streaming") && Boolean(onStop);
  let icon = sendIcon ?? <ArrowUpIcon />;
  if (status === "submitted") {
    icon = <Loader2Icon className="animate-spin" />;
  } else if (stopping) {
    icon = <SquareIcon />;
  }
  return (
    <primitives.InputGroupButton
      aria-label={stopping ? "Stop" : "Send"}
      size="icon-sm"
      variant={stopping ? "outline" : "default"}
      type={stopping ? "button" : "submit"}
      disabled={stopping ? stopDisabled : !canSend}
      onClick={stopping ? onStop : undefined}
    >
      {icon}
    </primitives.InputGroupButton>
  );
};

const composerActionStatus = (
  status: ChatStatus,
  allowFollowUp: boolean | undefined,
  hasDraft: boolean
): ChatStatus =>
  status === "streaming" && allowFollowUp === true && hasDraft
    ? "ready"
    : status;

const canSubmitDraft = (
  status: ChatStatus,
  hasDraft: boolean,
  draftLength: number
): boolean =>
  (status === "ready" || status === "error") &&
  hasDraft &&
  draftLength <= MAX_DRAFT_LENGTH;

/**
 * A controlled composer for runtimes that own their own submission lifecycle.
 *
 * @param {string} draft Current text controlled by the runtime.
 * @param {(draft: string) => void} onDraftChange Writes text changes back to the runtime.
 * @param {() => void} onSubmit Submits the current draft.
 * @param {boolean} disabled Disables submission.
 * @param {ChatStatus | undefined} status Runtime-owned status value.
 * @param {(() => void) | undefined} onStop Cancels the active submission.
 * @param {boolean | undefined} stopDisabled Runtime-owned stopDisabled value.
 * @param {boolean | undefined} autoFocus Focuses the input on mount.
 * @param {ReadonlyReactNode | undefined} tools Tool controls in the footer.
 * @param {ReadonlyReactNode | undefined} attachments Current attached files.
 * @param {boolean | undefined} hasAttachments Runtime-owned hasAttachments value.
 * @param {boolean | undefined} readOnly Runtime-owned readOnly value.
 * @param {boolean | undefined} allowDraftWhileBusy Allows typing during a submission without a Stop action.
 * @param {boolean | undefined} allowSendWhileStreaming Switches Stop to Send when the draft contains text or files.
 * @param {ComponentProps<"textarea">["onPaste"] | undefined} onPaste Runtime-owned onPaste value.
 * @returns {React.JSX.Element} The composed message interface.
 */
export const ChatComposer = ({
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
  allowDraftWhileBusy = false,
  allowSendWhileStreaming,
  onPaste,
  primitives = defaultPrimitives,
  sendIcon,
}: {
  readonly primitives?: ComposerPrimitives;
  readonly sendIcon?: ReadonlyReactNode;
  readonly attachments?: ReadonlyReactNode;
  readonly hasAttachments?: boolean;
  readonly readOnly?: boolean;
  readonly allowDraftWhileBusy?: boolean;
  readonly allowSendWhileStreaming?: boolean;
  readonly onPaste?: ComponentProps<"textarea">["onPaste"];
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
  const mounted = useMounted();
  const busy = status === "submitted" || status === "streaming";
  const hasDraft = Boolean(draft.trim()) || hasAttachments;
  const actionStatus = composerActionStatus(
    status,
    allowSendWhileStreaming,
    hasDraft
  );
  const editorReadOnly = readOnly || (busy && !onStop && !allowDraftWhileBusy);
  const inputRef = useAutoFocus(autoFocus && !editorReadOnly);
  useLayoutEffect((): (() => void) | undefined => {
    const input = inputRef.current;
    if (!input || !draft || CSS.supports("field-sizing", "content")) {
      return undefined;
    }

    // Clearing the explicit height lets shorter or newly unwrapped drafts shrink.
    const fitDraft = (): void => {
      input.style.height = "";
      input.style.height = `${input.scrollHeight}px`;
    };
    fitDraft();
    let width = input.offsetWidth;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      if (input.offsetWidth !== width) {
        width = input.offsetWidth;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(fitDraft);
      }
    });
    observer.observe(input);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      input.style.height = "";
    };
  }, [draft, inputRef]);
  const canSend =
    !disabled &&
    !editorReadOnly &&
    canSubmitDraft(actionStatus, hasDraft, draft.length);
  const submit = (): void => {
    if (canSend) {
      onSubmit();
    }
  };
  return (
    <PromptForm
      primitives={primitives}
      editable={!editorReadOnly}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      attachments={attachments}
      tools={tools}
      actions={
        <ComposerAction
          primitives={primitives}
          sendIcon={sendIcon}
          status={canSend ? actionStatus : status}
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
      <InputGroupTextarea
        aria-label="Message"
        className="max-h-[max(35svh,5rem)] min-h-[60px] flex-none [scrollbar-width:thin] overflow-y-auto px-2.5 pt-2.5 pb-[5px] leading-normal [tab-size:1] placeholder:text-base placeholder-shown:pt-2 placeholder-shown:pl-3 sm:min-h-[80px] md:text-[15px]"
        data-testid="multimodal-input"
        dir="auto"
        ref={inputRef}
        rows={1}
        spellCheck
        value={draft}
        onChange={(event) => {
          onDraftChange(event.currentTarget.value);
        }}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            !event.nativeEvent.isComposing &&
            // oxlint-disable-next-line typescript/no-deprecated -- WebKit clears isComposing before the IME confirmation keydown; 229 still identifies it.
            event.nativeEvent.keyCode !== 229 &&
            (isMobile ? event.ctrlKey : !event.shiftKey)
          ) {
            event.preventDefault();
            submit();
          }
        }}
        onPaste={onPaste}
        placeholder={
          isMobile
            ? "Send a message... (Ctrl+Enter to send)"
            : "Send a message..."
        }
        readOnly={!mounted || editorReadOnly}
      />
    </PromptForm>
  );
};
