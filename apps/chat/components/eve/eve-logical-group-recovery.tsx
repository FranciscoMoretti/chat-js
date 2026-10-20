"use client";

import { withTaskCleanup } from "@/components/task-cleanup";

import { hasText } from "@/components/text-value";

import { useQueryClient } from "@tanstack/react-query";
import type { JSX as ReactJSX } from "react";
import React, { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  advanceWaitingResponseGroup,
  canAutomaticallyProgressResponseGroup,
  stopAutomaticResponseGroupProgress,
  readResponseGroupDraft,
  requestResponseGroup,
  retainResponseGroupDraft,
} from "@/lib/eve/create-response-group";
import { useTRPC } from "@/trpc/react";

export const EveLogicalGroupRecovery = ({
  groupId,
  ownerId,
  autoOnly = false,
}: {
  readonly autoOnly?: boolean;
  readonly groupId: string;
  readonly ownerId: string;
}): ReactJSX.Element | null => {
  const [, startEventAction] = React.useTransition();
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [waiting, setWaiting] = useState(false);
  const [failure, setFailure] = useState<string>();
  const recover = async (): Promise<void> => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setFailure(undefined);
    await withTaskCleanup(
      async () => {
        try {
          const saved = readResponseGroupDraft(
            sessionStorage,
            ownerId,
            groupId
          );
          if (!saved) {
            setFailure(
              "Return to the tab where you sent this comparison to retry its saved request."
            );
            return;
          }
          stopAutomaticResponseGroupProgress(sessionStorage, ownerId, groupId);
          const result = await requestResponseGroup(saved);
          retainResponseGroupDraft(sessionStorage, ownerId, saved, result);
          setWaiting(
            canAutomaticallyProgressResponseGroup(
              sessionStorage,
              ownerId,
              groupId
            )
          );
          await queryClient.invalidateQueries({
            queryKey: trpc.eve.branches.pathKey(),
          });
        } catch (error) {
          setFailure(
            error instanceof Error
              ? error.message
              : "Comparison recovery failed."
          );
        }
      },
      () => {
        inFlight.current = false;
        setBusy(false);
      }
    );
  };
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const progress = async (): Promise<void> => {
      setWaiting(
        canAutomaticallyProgressResponseGroup(sessionStorage, ownerId, groupId)
      );
      if (
        !inFlight.current &&
        canAutomaticallyProgressResponseGroup(sessionStorage, ownerId, groupId)
      ) {
        inFlight.current = true;
        await withTaskCleanup(
          async () => {
            try {
              const result = await advanceWaitingResponseGroup(
                sessionStorage,
                ownerId,
                groupId
              );
              if (!disposed) {
                setWaiting(
                  canAutomaticallyProgressResponseGroup(
                    sessionStorage,
                    ownerId,
                    groupId
                  )
                );
                if (result) {
                  await queryClient.invalidateQueries({
                    queryKey: trpc.eve.branches.pathKey(),
                  });
                }
              }
            } catch (error) {
              if (!disposed) {
                setWaiting(false);
                setFailure(
                  error instanceof Error
                    ? error.message
                    : "Comparison progress is unconfirmed. Retry the saved request."
                );
              }
            }
          },
          () => {
            inFlight.current = false;
          }
        );
      }
      if (!disposed) {
        timer = setTimeout(() => {
          void progress();
        }, 5000);
      }
    };
    timer = setTimeout(() => {
      void progress();
    }, 0);
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [groupId, ownerId, queryClient, trpc]);
  if (autoOnly && !waiting) {
    return null;
  }
  return (
    <section aria-label="Comparison recovery">
      <p>
        {waiting
          ? "Waiting for the shared workspace. Responses continue automatically in this tab."
          : "This response is not confirmed."}
      </p>
      {hasText(failure) && <p role="alert">{failure}</p>}
      {!autoOnly && (
        <Button
          disabled={busy || waiting}

          onClick={() => {
            const completion = recover();
            startEventAction(async () => {
              await completion;
            });
          }}
        >
          Retry response
        </Button>
      )}
      {!autoOnly && (
        <Button
          disabled={busy}
          variant="ghost"

          onClick={() => {
            void queryClient.invalidateQueries({
              queryKey: trpc.eve.branches.pathKey(),
            });
          }}
        >
          Check again
        </Button>
      )}
    </section>
  );
};
