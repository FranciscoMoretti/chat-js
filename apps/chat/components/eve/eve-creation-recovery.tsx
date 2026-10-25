"use client";
import { projectCreationScope } from "@/lib/eve/project-creation";

import { withTaskCleanup } from "@/components/task-cleanup";

import { hasText } from "@/components/text-value";

import { useRouter } from "next/navigation";
import type { JSX as ReactJSX } from "react";
import React, { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createClientSnapshot } from "@/components/client-snapshot";

import { Button } from "@/components/ui/button";
import { CreationRejectedError } from "@/lib/eve/create-conversation";
import { eveMessageTitle } from "@/lib/eve/message-input";
import {
  moveRejectedContextCreation,
  readCreationRequest,
} from "@/lib/eve/pending-create";
import type { CreationScope } from "@/lib/eve/pending-create";
import { resolveCreationRequest } from "@/lib/eve/resolve-creation-request";

const recoveryStatus = (
  loaded: boolean,
  pending: boolean,
  rejected: boolean,
  canClear: boolean,
  label: string
): string => {
  if (rejected) {
    return canClear
      ? "The original request was rejected. Clear the saved request before sending again."
      : `The original request was rejected. You can continue with the saved message outside this ${label}.`;
  }
  if (!loaded) {
    return "Checking the saved request…";
  }
  return pending
    ? "Conversation creation is unconfirmed. Retry the saved request to recover it."
    : "This browser does not have the original request. Return to the tab where you sent it, or check again if creation is still running.";
};

const matchesSavedRequest = (
  saved: ReturnType<typeof readCreationRequest>,
  operationId: string | undefined,
  scope: Readonly<CreationScope> | undefined
): boolean => {
  if (!saved) {
    return false;
  }
  if (hasText(operationId)) {
    return saved.operationId === operationId;
  }
  return (
    scope?.context !== undefined &&
    projectCreationScope(saved)?.key === scope.context.key
  );
};

export const EveCreationRecovery = ({
  ownerId,
  operationId,
  firstMessage,
  scope,
  initiallyRejected = false,
  initialFailure = "",
  onClearRejected,
}: {
  readonly ownerId: string;
  readonly operationId?: string;
  readonly firstMessage: string;
  readonly scope?: Readonly<CreationScope>;
  readonly initiallyRejected?: boolean;
  readonly initialFailure?: string;
  readonly onClearRejected?: () => void;
}): ReactJSX.Element => {
  const context = scope?.context;
  const contextLabel = context?.label ?? "context";
  const [, startEventAction] = React.useTransition();
  const router = useRouter();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const store = useMemo(
    () =>
      createClientSnapshot<{
        pending: ReturnType<typeof readCreationRequest>;
        rejected: boolean;
        loaded: boolean;
        failure: string;
      }>(
        {
          pending: undefined,
          rejected: initiallyRejected,
          loaded: false,
          failure: "",
        },
        (current) => {
          try {
            const saved = readCreationRequest(sessionStorage, ownerId, scope);
            return {
              ...current,
              loaded: true,
              pending: matchesSavedRequest(saved, operationId, scope)
                ? saved
                : undefined,
            };
          } catch {
            return {
              ...current,
              loaded: true,
              failure: "The saved request could not be restored.",
            };
          }
        }
      ),
    [ownerId, operationId, scope, initiallyRejected]
  );
  const { pending, rejected, loaded, failure } = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  );
  const { setRejected, setFailure } = useMemo(
    () => ({
      setRejected: (value: boolean): void => {
        store.set("rejected", value);
      },
      setFailure: (value: string): void => {
        store.set("failure", value);
      },
    }),
    [store]
  );

  const retry = async (): Promise<void> => {
    if (!pending || lock.current) {
      return;
    }
    lock.current = true;
    setBusy(true);
    setFailure("");

    await withTaskCleanup(
      async () => {
        try {
          const { id } = await resolveCreationRequest(
            sessionStorage,
            ownerId,
            pending,
            scope
          );
          globalThis.location.assign(`/chat/${id}`);
        } catch (error) {
          if (error instanceof CreationRejectedError && context !== undefined) {
            setRejected(true);
          }
          setFailure(
            error instanceof Error
              ? error.message
              : "Unable to recover. Try again."
          );
        }
      },
      () => {
        lock.current = false;
        setBusy(false);
      }
    );
  };
  const continueWithoutContext = (): void => {
    if (!(rejected && pending && context !== undefined)) {
      return;
    }
    try {
      moveRejectedContextCreation(
        sessionStorage,
        ownerId,
        context,
        pending.operationId
      );
      globalThis.location.assign("/");
    } catch (error) {
      setFailure(
        error instanceof Error ? error.message : "Unable to restore the draft."
      );
    }
  };

  const status = recoveryStatus(
    loaded,
    pending !== undefined,
    rejected,
    onClearRejected !== undefined,
    contextLabel
  );
  return (
    <section
      aria-label="Conversation recovery"
      className="mx-auto w-full max-w-3xl space-y-4 p-4"
    >
      <p className="break-words whitespace-pre-wrap">
        {pending ? eveMessageTitle(pending.message) : firstMessage}
      </p>
      <output className="block">{status}</output>
      {(failure || initialFailure) && (
        <p role="alert">{failure || initialFailure}</p>
      )}
      {rejected && onClearRejected && (
        <Button onClick={onClearRejected}>Clear rejected request</Button>
      )}
      {rejected && !onClearRejected && context !== undefined ? (
        <Button onClick={continueWithoutContext}>
          Continue without {contextLabel}
        </Button>
      ) : null}
      {!rejected && pending ? (
        <Button
          disabled={busy}

          onClick={() => {
            const completion = retry();
            startEventAction(async () => {
              await completion;
            });
          }}
        >
          {busy ? "Recovering…" : "Retry creation"}
        </Button>
      ) : null}
      {!pending && (
        <Button
          disabled={!loaded}
          onClick={() => {
            router.refresh();
          }}
          variant="outline"
        >
          Check again
        </Button>
      )}
    </section>
  );
};
