"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  optimisticEveMetadata,
  pendingEveMetadataMutations,
} from "@/lib/eve/optimistic-metadata";
import { useTRPC } from "@/trpc/react";
/* oxlint-enable sort-imports */
/* oxlint-disable import/no-named-export, import/prefer-default-export, jsdoc/require-returns, no-magic-numbers, oxc/no-async-await, oxc/no-optional-chaining, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async -- useEveMetadataMutations: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; jsdoc/require-returns: the inferred or annotated return type describes the value; the prose documents behavior rather than duplicate tags; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 1); oxc/no-async-await: await preserves ordered requests and catch behavior in this feature operation; oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback (including rollback?.()); typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including patch: { title?: string; isPinned?: boolean }); typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity. */

/** Logical metadata is shared by every branch detail and every loaded history. */
export const useEveMetadataMutations = () => {
  const cache = useQueryClient();
  const trpc = useTRPC();
  const settle = async () => {
    if (pendingEveMetadataMutations(cache) > 1) {
      return;
    }
    await Promise.all([
      cache.invalidateQueries({ queryKey: trpc.eve.list.pathKey() }),
      cache.invalidateQueries({ queryKey: trpc.eve.get.pathKey() }),
    ]);
  };
  const optimistic = (
    id: string,
    patch: { title?: string; isPinned?: boolean }
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
/* oxlint-enable import/no-named-export, import/prefer-default-export, jsdoc/require-returns, no-magic-numbers, oxc/no-async-await, oxc/no-optional-chaining, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
