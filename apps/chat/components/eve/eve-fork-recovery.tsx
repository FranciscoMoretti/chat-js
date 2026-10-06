"use client";

import React from "react";
import type { JSX as ReactJSX } from "react";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { Button } from "@/components/ui/button";
/* oxlint-enable sort-imports */
import { eveMessageTitle } from "@/lib/eve/message-input";

import type { useEveFork } from "./use-eve-fork";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (EveForkRecovery); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-no-literals -- EveForkRecovery renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-disable max-lines-per-function -- EveForkRecovery: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision. */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/prefer-readonly-parameter-types, typescript/strict-void-return -- EveForkRecovery: ; jsdoc/require-param: the TypeScript signature describes these parameters; the prose documents behavior rather than duplicate tags; jsdoc/require-returns: the inferred or annotated return type describes the value; the prose documents behavior rather than duplicate tags; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-void-return: this library event API ignores the return value while the existing handler owns its async pending and error lifecycle. */

/** Only exceptional recovery needs extra chrome; successful forks stay in the transcript. */
export const EveForkRecovery = ({
  fork,
  showError = true,
}: {
  fork: ReturnType<typeof useEveFork>;
  showError?: boolean;
}): ReactJSX.Element => {
  const handleRetry = fork.retry;
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
              <p>
                Response creation is unconfirmed. Recover the saved request
                before sending again.
              </p>
              <p className="whitespace-pre-wrap">
                {eveMessageTitle(fork.pending.message)}
              </p>
              <Button
                disabled={fork.busy}
                // oxlint-disable-next-line typescript/no-misused-promises -- #585: Fork recovery and family refetch own retry and error state in the fork hook.
                onClick={handleRetry}
                size="sm"
              >
                {
                  // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
                  "modelIds" in fork.pending
                    ? "Recover comparison"
                    : "Recover version"
                }
              </Button>
            </>
          )}
        </section>
      )}
    </>
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable max-lines-per-function */
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/prefer-readonly-parameter-types, typescript/strict-void-return */
