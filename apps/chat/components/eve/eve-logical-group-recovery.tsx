"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

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
  groupId: string;
  ownerId: string;
}) => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();
  const recover = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setFailure(undefined);
    try {
      const saved = readResponseGroupDraft(sessionStorage, ownerId, groupId);
      if (!saved) {
        // oxlint-disable-next-line react/todo -- Preserve explicit recovery rejection without changing its error handling.
        throw new Error(
          "Return to the tab where you sent this comparison to retry its saved request."
        );
      }
      const result = await requestResponseGroup(saved);
      retainResponseGroupDraft(sessionStorage, ownerId, saved, result);
      await queryClient.invalidateQueries({
        queryKey: trpc.eve.branches.pathKey(),
      });
    } catch (error) {
      setFailure(
        error instanceof Error ? error.message : "Comparison recovery failed."
      );
      // oxlint-disable-next-line react/todo -- Always release recovery pending state.
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-label="Comparison recovery">
      <p>This response is not confirmed.</p>
      {failure && <p role="alert">{failure}</p>}
      <Button disabled={busy} onClick={recover}>
        Retry response
      </Button>
      <Button
        disabled={busy}
        variant="ghost"
        onClick={() =>
          queryClient.invalidateQueries({
            queryKey: trpc.eve.branches.pathKey(),
          })
        }
      >
        Check again
      </Button>
    </section>
  );
};
