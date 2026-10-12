"use client";

import React from "react";
import type { JSX as ReactJSX } from "react";

import { Button } from "@/components/ui/button";
import { eveMessageTitle } from "@/lib/eve/message-input";

import type { useEveFork } from "./use-eve-fork";

/** Only exceptional recovery needs extra chrome; successful forks stay in the transcript. */
export const EveForkRecovery = ({
  fork,
  showError = true,
}: {
  readonly fork: Readonly<
    Pick<
      ReturnType<typeof useEveFork>,
      "retry" | "pending" | "rejected" | "busy" | "error"
    >
  > & {
    readonly family: Readonly<
      Pick<ReturnType<typeof useEveFork>["family"], "isError" | "refetch">
    >;
  };
  readonly showError?: boolean;
}): ReactJSX.Element => {
  const [, startEventAction] = React.useTransition();
  const handleRetry = fork.retry;
  let recoveryLabel = "Recover version";
  if (fork.pending && "modelIds" in fork.pending) {
    recoveryLabel = "Recover comparison";
  }
  if (fork.rejected) {
    recoveryLabel = "Clear rejected request";
  }
  let recoveryStatus =
    "Response creation is unconfirmed. Recover the saved request before sending again.";
  if (fork.rejected) {
    recoveryStatus =
      "The original request was rejected. Clear the saved request before sending again.";
  }
  return (
    <>
      {fork.family.isError && (
        <p className="text-sm" role="alert">
          Versions could not be loaded.{" "}
          <Button
            onClick={() => {
              void fork.family.refetch();
            }}
            variant="ghost"
          >
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
              <p>{recoveryStatus}</p>
              <p className="whitespace-pre-wrap">
                {eveMessageTitle(fork.pending.message)}
              </p>
              <Button
                disabled={fork.busy}

                onClick={() => {
                  const completion = handleRetry();
                  startEventAction(async () => {
                    await completion;
                  });
                }}
                size="sm"
              >
                {recoveryLabel}
              </Button>
            </>
          )}
        </section>
      )}
    </>
  );
};
