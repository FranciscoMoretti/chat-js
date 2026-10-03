"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { Project } from "@/lib/db/schema";
import { useTRPC } from "@/trpc/react";
/* oxlint-enable sort-imports */
/* oxlint-disable import/no-named-export, import/prefer-default-export, max-lines-per-function, no-ternary, no-undefined, oxc/no-async-await, oxc/no-optional-chaining, oxc/no-rest-spread-properties, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async -- useRenameProject: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable (including old ? { ...old, name: nextName } : old); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; oxc/no-async-await: await preserves ordered requests and catch behavior in this feature operation; oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback (including context?.previous); oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including _error); typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity. */

export const useRenameProject = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.project.update.mutationOptions<{
      previous?: Project[];
      detail?: Project | null;
    }>({
      onError: (_error, _variables, context) => {
        if (context?.previous) {
          queryClient.setQueryData(
            trpc.project.list.queryKey(),
            context.previous
          );
        }
        if (context?.detail) {
          queryClient.setQueryData(
            trpc.project.getById.queryKey({ id: _variables.id }),
            context.detail
          );
        }
        toast.error("Failed to rename project");
      },
      onMutate: async (variables) => {
        const listKey = trpc.project.list.queryKey();
        const detailKey = trpc.project.getById.queryKey({ id: variables.id });
        await Promise.all([
          queryClient.cancelQueries({ queryKey: listKey }),
          queryClient.cancelQueries({ queryKey: detailKey }),
        ]);
        const detail = queryClient.getQueryData<Project | null>(detailKey);
        const previous = queryClient.getQueryData<Project[]>(listKey);
        const nextName =
          typeof variables.updates.name === "string"
            ? variables.updates.name
            : undefined;
        if (typeof nextName === "string" && nextName !== "") {
          queryClient.setQueryData<Project | null>(detailKey, (old) =>
            old ? { ...old, name: nextName } : old
          );
          queryClient.setQueryData<Project[] | undefined>(listKey, (old) =>
            old?.map((project) =>
              project.id === variables.id
                ? { ...project, name: nextName }
                : project
            )
          );
        }
        return { detail, previous };
      },
      onSettled: () =>
        queryClient.invalidateQueries({ queryKey: trpc.project.pathKey() }),
      onSuccess: () => toast.success("Project renamed"),
    })
  );
};
/* oxlint-enable import/no-named-export, import/prefer-default-export, max-lines-per-function, no-ternary, no-undefined, oxc/no-async-await, oxc/no-optional-chaining, oxc/no-rest-spread-properties, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
