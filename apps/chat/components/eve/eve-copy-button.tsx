"use client";

import Link from "next/link";
import { useRef, useState } from "react";

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

export function EveCopyButton({
  sourceConversationId,
  recovery,
}: {
  sourceConversationId: string;
  recovery?: EveCopyInput;
}) {
  const session = useSession();
  const model = useDefaultModel();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rejected, setRejected] = useState(false);
  const [destination, setDestination] = useState<string>();
  const ownerId = session.data?.user.id;

  async function save() {
    if (lock.current || !ownerId) {
      return;
    }
    lock.current = true;
    setBusy(true);
    setRejected(false);
    setError("");
    let input = recovery;
    try {
      input ??= preparePendingEveCopy(
        sessionStorage,
        ownerId,
        sourceConversationId,
        getPrimarySelectedModelId(model) ?? config.ai.workflows.chat
      );
      const result = await requestEveCopy(input);
      forgetConfirmedRequest(ownerId, input);
      window.location.assign(`/chat/${result.id}`);
    } catch (cause) {
      showFailure(cause, input, ownerId);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function showFailure(
    cause: unknown,
    input: EveCopyInput | undefined,
    ownerId: string
  ) {
    if (cause instanceof EveCopyRequestError) {
      if (!cause.retryable && input) {
        forgetConfirmedRequest(ownerId, input);
      }
      setRejected(!cause.retryable);
      setDestination(cause.retryable ? cause.conversationId : undefined);
    }
    setError(
      cause instanceof Error
        ? cause.message
        : "Saving is unconfirmed. Retry the same copy."
    );
  }

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
  if (recovery || error) {
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
        <p className="px-4 pt-4 text-sm" role="status">
          Saving is unconfirmed. Retry to finish the saved copy.
        </p>
      )}
      {!(rejected && recovery) && (
        <CloneChatButtonView
          disabled={session.isPending}
          isPending={busy}
          label={label}
          onClick={save}
        />
      )}
      {error && (
        <p className="px-4 pb-4 text-center text-sm" role="alert">
          {error}
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
}

function forgetConfirmedRequest(ownerId: string, input: EveCopyInput) {
  try {
    finishPendingEveCopy(sessionStorage, ownerId, input);
  } catch {
    // A confirmed binding or rejection remains authoritative when browser storage is unavailable.
  }
}
