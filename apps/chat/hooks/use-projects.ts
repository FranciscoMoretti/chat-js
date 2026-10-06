"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { Project } from "@/lib/db/schema";
/* oxlint-enable sort-imports */
import { useTRPC } from "@/trpc/react";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (useRenameProject); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable max-lines-per-function, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async -- useRenameProject: ; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; ; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including _error); typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity. */

export const useRenameProject = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this return statement's awaited sequencing and rejected-Promise behavior. */
  return useMutation(
    trpc.project.update.mutationOptions<{
      previous?: Project[];
      detail?: Project | null;
    }>({
      onError: (_error, _variables, context) => {
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading previous from context; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
        if (context?.previous) {
          queryClient.setQueryData(
            trpc.project.list.queryKey(),
            context.previous
          );
        }
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading detail from context; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
          queryClient.setQueryData<Project | null>(detailKey, (old) => {
            if (old) {
              // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing old own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
              return { ...old, name: nextName };
            }
            return old;
          });
          queryClient.setQueryData<Project[] | undefined>(listKey, (old) =>
            // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading map from old; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
            old?.map((project) => {
              if (project.id === variables.id) {
                // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing project own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
                return { ...project, name: nextName };
              }
              return project;
            })
          );
        }
        return { detail, previous };
      },
      onSettled: () =>
        queryClient.invalidateQueries({ queryKey: trpc.project.pathKey() }),
      onSuccess: () => toast.success("Project renamed"),
    })
  );
  /* oxlint-enable oxc/no-async-await */
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable max-lines-per-function, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
