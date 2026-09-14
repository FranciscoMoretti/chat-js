"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { CreationRejectedError } from "@/lib/eve/create-conversation";
import { eveMessageTitle } from "@/lib/eve/message-input";
import {
  moveRejectedProjectCreation,
  readCreationRequest,
} from "@/lib/eve/pending-create";
import type { CreationScope } from "@/lib/eve/pending-create";
import { resolveCreationRequest } from "@/lib/eve/resolve-creation-request";

export const EveCreationRecovery = ({
  ownerId,
  operationId,
  firstMessage,
  scope,
  initiallyRejected = false,
}: {
  ownerId: string;
  operationId?: string;
  firstMessage: string;
  scope?: CreationScope;
  initiallyRejected?: boolean;
}) => {
  const router = useRouter();
  const lock = useRef(false);
  const [pending, setPending] =
    useState<ReturnType<typeof readCreationRequest>>();
  const [rejected, setRejected] = useState(initiallyRejected);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- Reset recovery state when the server-provided rejection status changes.
    setRejected(initiallyRejected);
    try {
      const saved = readCreationRequest(sessionStorage, ownerId, scope);
      setPending(
        saved &&
          (operationId
            ? saved.operationId === operationId
            : scope?.projectId && saved.projectId === scope.projectId)
          ? saved
          : undefined
      );
    } catch {
      setFailure("The saved request could not be restored.");
    }
    setLoaded(true);
  }, [ownerId, operationId, scope, initiallyRejected]);

  const retry = async () => {
    if (!pending || lock.current) {
      return;
    }
    lock.current = true;
    setBusy(true);
    setFailure("");
    /* oxlint-disable react/todo -- Preserve the recovery lock cleanup in finally. */
    try {
      const id = await resolveCreationRequest(
        sessionStorage,
        ownerId,
        pending,
        scope
      );
      window.location.assign(`/chat/${id}`);
    } catch (error) {
      if (error instanceof CreationRejectedError && scope?.projectId) {
        setRejected(true);
      }
      setFailure(
        error instanceof Error ? error.message : "Unable to recover. Try again."
      );
      // oxlint-disable-next-line react/todo -- React Compiler cannot analyze required recovery lock cleanup in finally.
    } finally {
      lock.current = false;
      setBusy(false);
    }
    /* oxlint-enable react/todo */
  };

  const continueWithoutProject = () => {
    if (!(rejected && pending && scope?.projectId)) {
      return;
    }
    try {
      moveRejectedProjectCreation(
        sessionStorage,
        ownerId,
        scope.projectId,
        pending.operationId
      );
      window.location.assign("/");
    } catch (error) {
      setFailure(
        error instanceof Error ? error.message : "Unable to restore the draft."
      );
    }
  };

  let status = "Checking the saved request…";
  if (loaded) {
    status = pending
      ? "Conversation creation is unconfirmed. Retry the saved request to recover it."
      : "This browser does not have the original request. Return to the tab where you sent it, or check again if creation is still running.";
  }
  if (rejected) {
    status =
      "The original request was rejected. You can continue with the saved message outside this project.";
  }
  return (
    <section aria-label="Conversation recovery" className="space-y-4 p-4">
      <p className="break-words whitespace-pre-wrap">
        {pending ? eveMessageTitle(pending.message) : firstMessage}
      </p>
      <output>{status}</output>
      {failure && <p role="alert">{failure}</p>}
      {rejected && scope?.projectId ? (
        <Button onClick={continueWithoutProject}>
          Continue without project
        </Button>
      ) : null}
      {!rejected && pending ? (
        <Button disabled={busy} onClick={retry}>
          {busy ? "Recovering…" : "Retry creation"}
        </Button>
      ) : null}
      {!pending && (
        <Button
          disabled={!loaded}
          onClick={() => router.refresh()}
          variant="outline"
        >
          Check again
        </Button>
      )}
    </section>
  );
};
