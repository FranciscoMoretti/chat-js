"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import { useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  readResponseGroupDraft,
  requestResponseGroup,
  retainResponseGroupDraft,
} from "@/lib/eve/create-response-group";
import { useTRPC } from "@/trpc/react";
/* oxlint-enable sort-imports */
/* oxlint-disable import/no-named-export, import/prefer-default-export, max-lines-per-function, max-statements, no-ternary, no-undefined, oxc/no-async-await, react-perf/jsx-no-new-function-as-prop, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, typescript/strict-void-return -- EveLogicalGroupRecovery: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable; no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; oxc/no-async-await: await preserves ordered requests and catch behavior in this feature operation; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including failure); typescript/strict-void-return: this library event API ignores the return value while the existing handler owns its async pending and error lifecycle. */

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
      <Button
        disabled={busy}
        // oxlint-disable-next-line typescript/no-misused-promises -- #585: Response recovery owns admission/retry state; React Query owns branch invalidation failures.
        onClick={recover}
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
/* oxlint-enable import/no-named-export, import/prefer-default-export, max-lines-per-function, max-statements, no-ternary, no-undefined, oxc/no-async-await, react-perf/jsx-no-new-function-as-prop, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, typescript/strict-void-return */
