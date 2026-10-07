"use client";

import { useQueryClient } from "@tanstack/react-query";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { JSX as ReactJSX } from "react";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import React, { useState } from "react";
/* oxlint-enable sort-imports */

import { Button } from "@/components/ui/button";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  readResponseGroupDraft,
  requestResponseGroup,
  retainResponseGroupDraft,
} from "@/lib/eve/create-response-group";
/* oxlint-enable sort-imports */
import { useTRPC } from "@/trpc/react";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (EveLogicalGroupRecovery); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-no-literals -- EveLogicalGroupRecovery renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-disable max-lines-per-function, max-statements, no-undefined, react-perf/jsx-no-new-function-as-prop, typescript/strict-boolean-expressions, typescript/strict-void-return -- EveLogicalGroupRecovery: ; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including failure); typescript/strict-void-return: this library event API ignores the return value while the existing handler owns its async pending and error lifecycle. */

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
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve recover's awaited sequencing and rejected-Promise behavior. */
  const recover = async (): Promise<void> => {
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
        // oxlint-disable-next-line no-ternary -- Keep setFailure argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        error instanceof Error ? error.message : "Comparison recovery failed."
      );
      // oxlint-disable-next-line react/todo -- Always release recovery pending state.
    } finally {
      setBusy(false);
    }
  };
  /* oxlint-enable oxc/no-async-await */
  return (
    <section aria-label="Comparison recovery">
      <p>This response is not confirmed.</p>
      {failure && <p role="alert">{failure}</p>}
      <Button
        disabled={busy}

        onClick={() => {
          startEventAction(recover);
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable max-lines-per-function, max-statements, no-undefined, react-perf/jsx-no-new-function-as-prop, typescript/strict-boolean-expressions, typescript/strict-void-return */
