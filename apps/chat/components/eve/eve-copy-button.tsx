"use client";

import Link from "next/link";
import React, { useRef, useState } from "react";

import { CloneChatButtonView } from "@/components/clone-chat-button-view";
import { getPrimarySelectedModelId } from "@/lib/ai/types";
import { config } from "@/lib/config";
import type { EveCopyInput } from "@/lib/eve/copy-input";
import {
  EveCopyRequestError,
  finishPendingEveCopy,
  preparePendingEveCopy,
  requestEveCopy,
} from "@/lib/eve/request-copy";
import { useDefaultModel } from "@/providers/default-model-provider";
import { useSession } from "@/providers/session-provider";
/* oxlint-disable init-declarations, max-lines-per-function, max-statements, no-undefined, react-perf/jsx-no-new-function-as-prop, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, typescript/strict-void-return -- EveCopyButton: init-declarations: branches initialize this value before use; an eager undefined initializer adds a second missing-value state; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including ownerId); typescript/strict-void-return: this library event API ignores the return value while the existing handler owns its async pending and error lifecycle. */

const EveCopyButton = ({
  sourceConversationId,
  recovery,
}: {
  sourceConversationId: string;
  recovery?: EveCopyInput;
}) => {
  const session = useSession();
  const model = useDefaultModel();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [rejected, setRejected] = useState(false);
  const [destination, setDestination] = useState<string>();
  const ownerId = session.data?.user.id;

  const save = async () => {
    if (lock.current || !ownerId) {
      return;
    }
    lock.current = true;
    setBusy(true);
    setRejected(false);
    setFailure("");
    let input = recovery;
    try {
      // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: Preserve the existing lazy initialization or absent-value guard; replacing it with coalescing changes the control-flow form.
      if (!input) {
        input = preparePendingEveCopy(
          sessionStorage,
          ownerId,
          sourceConversationId,
          getPrimarySelectedModelId(model) ?? config.ai.workflows.chat
        );
      }
      const result = await requestEveCopy(input);
      // oxlint-disable-next-line eslint/no-use-before-define -- Storage cleanup is kept with the successful copy transition.
      forgetConfirmedRequest(ownerId, input);
      globalThis.location.assign(`/chat/${result.id}`);
    } catch (error) {
      // oxlint-disable-next-line eslint/no-use-before-define -- Failure handling is shared by retry and initial copy.
      showFailure(error, input, ownerId);
      // oxlint-disable-next-line react/todo -- Preserve lock cleanup while React Compiler lacks finally support.
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const showFailure = (
    cause: unknown,
    input: EveCopyInput | undefined,
    accountOwnerId: string
  ) => {
    if (cause instanceof EveCopyRequestError) {
      if (!cause.retryable && input) {
        // oxlint-disable-next-line eslint/no-use-before-define -- Failed copies must clear their durable request.
        forgetConfirmedRequest(accountOwnerId, input);
      }
      setRejected(!cause.retryable);
      setDestination(cause.retryable ? cause.conversationId : undefined);
    }
    setFailure(
      cause instanceof Error
        ? cause.message
        : "Saving is unconfirmed. Retry the same copy."
    );
  };

  if (!(session.isPending || ownerId)) {
    return (
      <p className="p-4 text-center text-sm">
        <Link
          className="underline"
          href={`/login?returnTo=${encodeURIComponent(`/share/${sourceConversationId}`)}`}
        >
          Sign in to save this conversation
        </Link>
      </p>
    );
  }
  let label: string | undefined;
  if (recovery || failure) {
    label = "Retry saving";
  }
  if (rejected) {
    label = "Save another copy";
  }
  return (
    <section
      aria-label={recovery ? "Saved copy recovery" : "Save shared conversation"}
    >
      {recovery && (
        <output className="px-4 pt-4 text-sm">
          Saving is unconfirmed. Retry to finish the saved copy.
        </output>
      )}
      {!(rejected && recovery) && (
        <CloneChatButtonView
          disabled={session.isPending}
          isPending={busy}
          label={label}

          // oxlint-disable-next-line typescript/no-misused-promises -- #585: Copy recovery owns durable request identity, retry state, and failure feedback.
          onClick={save}
        />
      )}
      {failure && (
        <p className="px-4 pb-4 text-center text-sm" role="alert">
          {failure}
        </p>
      )}
      {destination && (
        <p className="pb-4 text-center text-sm">
          <Link className="underline" href={`/chat/${destination}`}>
            Open saved copy recovery
          </Link>
        </p>
      )}
    </section>
  );
};
/* oxlint-enable init-declarations, max-lines-per-function, max-statements, no-undefined, react-perf/jsx-no-new-function-as-prop, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, typescript/strict-void-return */

const forgetConfirmedRequest = (ownerId: string, input: EveCopyInput): void => {
  try {
    finishPendingEveCopy(sessionStorage, ownerId, input);
  } catch {
    // A confirmed binding or rejection remains authoritative when browser storage is unavailable.
  }
};

export { EveCopyButton };
