"use client";

import React from "react";
import type { JSX as ReactJSX } from "react";

import { Button } from "@/components/ui/button";

/** Only exceptional recovery needs extra chrome; successful forks stay in the transcript. */
export const EveForkRecovery = ({
  fork,
  showError = true,
}: {
  readonly fork: {
    readonly retry: () => Promise<void>;
    readonly recovery?: { readonly message: string; readonly label: string };
    readonly rejected: boolean;
    readonly busy: boolean;
    readonly error: string;
    readonly family: {
      readonly isError: boolean;
      readonly refetch: () => Promise<unknown>;
    };
  };
  readonly showError?: boolean;
}): ReactJSX.Element => {
  const [, startEventAction] = React.useTransition();
  const handleRetry = fork.retry;
  const recoveryLabel = fork.rejected
    ? "Clear rejected request"
    : fork.recovery?.label;
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
      {!fork.busy && ((showError && fork.error) || fork.recovery) && (
        <section aria-label="Version recovery" className="space-y-2 text-sm">
          {showError && fork.error && <p role="alert">{fork.error}</p>}
          {fork.recovery && (
            <>
              <p>{recoveryStatus}</p>
              <p className="whitespace-pre-wrap">{fork.recovery.message}</p>
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
