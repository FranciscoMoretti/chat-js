"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  optimisticEveMetadata,
  pendingEveMetadataMutations,
} from "@/lib/eve/optimistic-metadata";
/* oxlint-enable sort-imports */
import { useTRPC } from "@/trpc/react";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (useEveMetadataMutations); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable jsdoc/require-returns, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async -- useEveMetadataMutations: ; jsdoc/require-returns: the inferred or annotated return type describes the value; the prose documents behavior rather than duplicate tags; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 1); ; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including patch: { title?: string; isPinned?: boolean }); typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity. */

/** Logical metadata is shared by every branch detail and every loaded history. */
export const useEveMetadataMutations = () => {
  const cache = useQueryClient();
  const trpc = useTRPC();
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve settle's awaited sequencing and rejected-Promise behavior. */
  const settle = async (): Promise<void> => {
    if (pendingEveMetadataMutations(cache) > 1) {
      return;
    }
    await Promise.all([
      cache.invalidateQueries({ queryKey: trpc.eve.list.pathKey() }),
      cache.invalidateQueries({ queryKey: trpc.eve.get.pathKey() }),
    ]);
  };
  /* oxlint-enable oxc/no-async-await */
  const optimistic = (
    id: string,
    patch: { readonly title?: string; readonly isPinned?: boolean }
  ) =>
    optimisticEveMetadata(
      cache,
      trpc.eve.list.pathKey(),
      trpc.eve.get.pathKey(),
      id,
      patch
    );
  const rename = useMutation(
    trpc.eve.rename.mutationOptions<() => void>({
      meta: { eveMetadata: true },
      onError: (error, _input, rollback) => {
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling rollback; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining.
        rollback?.();
        toast.error(error.message);
      },
      onMutate: ({ id, title }) => optimistic(id, { title }),
      onSettled: settle,
      scope: { id: "eve-rename" },
    })
  );
  const pin = useMutation(
    trpc.eve.pin.mutationOptions<() => void>({
      meta: { eveMetadata: true },
      onError: (error, _input, rollback) => {
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling rollback; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining.
        rollback?.();
        toast.error(error.message);
      },
      onMutate: ({ id, isPinned }) => optimistic(id, { isPinned }),
      onSettled: settle,
      scope: { id: "eve-pin" },
    })
  );
  return { pin, rename };
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable jsdoc/require-returns, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
