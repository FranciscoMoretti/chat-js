"use client";

import { withTaskCleanup } from "@/components/task-cleanup";

import { hasText } from "@/components/text-value";

import { useQueryClient } from "@tanstack/react-query";
import type { JSX as ReactJSX } from "react";
import React, { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  readResponseGroupDraft,
  requestResponseGroup,
  retainResponseGroupDraft,
} from "@/lib/eve/create-response-group";
import { useTRPC } from "@/trpc/react";

export const EveLogicalGroupRecovery = ({
  groupId,
  ownerId,
}: {
  readonly groupId: string;
  readonly ownerId: string;
}): ReactJSX.Element => {
  const [, startEventAction] = React.useTransition();
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();
  const recover = async (): Promise<void> => {
    if (busy) {
      return;
    }
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
          const result = await requestResponseGroup(saved);
          retainResponseGroupDraft(sessionStorage, ownerId, saved, result);
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
        setBusy(false);
      }
    );
  };
  return (
    <section aria-label="Comparison recovery">
      <p>This response is not confirmed.</p>
      {hasText(failure) && <p role="alert">{failure}</p>}
      <Button
        disabled={busy}

        onClick={() => {
          const completion = recover();
          startEventAction(async () => {
            await completion;
          });
        }}
      >
        Retry response
      </Button>
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
    </section>
  );
};
