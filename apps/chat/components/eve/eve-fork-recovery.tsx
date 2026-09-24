"use client";

import { Button } from "@/components/ui/button";
import { eveMessageTitle } from "@/lib/eve/message-input";

import type { useEveFork } from "./use-eve-fork";

/** Only exceptional recovery needs extra chrome; successful forks stay in the transcript. */
export const EveForkRecovery = ({
  fork,
  showError = true,
}: {
  fork: ReturnType<typeof useEveFork>;
  showError?: boolean;
}) => {
  const handleRetry = fork.retry;
  return (
    <>
      {fork.family.isError && (
        <p className="text-sm" role="alert">
          Versions could not be loaded.{" "}
          <Button onClick={() => fork.family.refetch()} variant="ghost">
            Retry
          </Button>
        </p>
      )}
      {fork.busy && <output className="sr-only">Creating response…</output>}
      {!fork.busy && ((showError && fork.error) || fork.pending) && (
        <section aria-label="Version recovery" className="space-y-2 text-sm">
          {showError && fork.error && <p role="alert">{fork.error}</p>}
          {fork.pending && (
            <>
              <p>
                Response creation is unconfirmed. Recover the saved request
                before sending again.
              </p>
              <p className="whitespace-pre-wrap">
                {eveMessageTitle(fork.pending.message)}
              </p>
              <Button disabled={fork.busy} onClick={handleRetry} size="sm">
                {"modelIds" in fork.pending
                  ? "Recover comparison"
                  : "Recover version"}
              </Button>
            </>
          )}
        </section>
      )}
    </>
  );
};
