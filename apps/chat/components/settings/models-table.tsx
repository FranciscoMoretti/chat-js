"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { JSX as ReactJSX } from "react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import React, { useCallback, useMemo, useRef } from "react";
/* oxlint-enable sort-imports */
import { toast } from "sonner";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { Table, TableBody } from "@/components/ui/table";
/* oxlint-enable sort-imports */
import type { AppModelId } from "@/lib/ai/app-model-id";
import { getDefaultEnabledModels } from "@/lib/ai/app-models";
// oxlint-disable-next-line sort-imports -- Oxfmt groups this type reader import by module; sort-imports requires a different binding-name or syntax order.
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { useChatModels } from "@/providers/chat-models-provider";
import { useTRPC } from "@/trpc/react";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { ModelRow } from "./model-row";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ModelsTable); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-no-literals -- ModelsTable renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-enable sort-imports */
/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, react/jsx-max-depth -- ModelsTable: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including -1); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships */

export const ModelsTable = ({
  search,
  className,
}: {
  readonly search: string;
  readonly className?: string;
}): ReactJSX.Element => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { allModels, models: enabledModels } = useChatModels();

  const { data: preferences, isLoading: prefsLoading } = useQuery(
    trpc.settings.getModelPreferences.queryOptions()
  );

  const queryKey = trpc.settings.getModelPreferences.queryKey();

  const { mutate: setModelEnabled } = useMutation(
    trpc.settings.setModelEnabled.mutationOptions({
      onError: (
        _err: unknown,
        _newData: unknown,
        /* oxlint-disable typescript/prefer-readonly-parameter-types -- Rollback passes the original cached array to the typed React Query updater; readonly nested arrays are rejected by that native cache receiving contract. */
        context: { readonly prev: typeof preferences } | undefined
        /* oxlint-enable typescript/prefer-readonly-parameter-types */
      ) => {
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading prev from context; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
        queryClient.setQueryData(queryKey, context?.prev);
        toast.error("Failed to update model preference");
      },
      onMutate: (newData) => {
        const prev = queryClient.getQueryData(queryKey);
        queryClient.setQueryData(
          queryKey,
          (old: ReadonlyNativeSurface<typeof preferences>) => {
            if (!old) {
              return old;
            }
            const idx = old.findIndex(
              (preference: { readonly modelId: string }) =>
                preference.modelId === newData.modelId
            );
            if (idx !== -1) {
              // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing old[idx] own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
              return old.with(idx, { ...old[idx], enabled: newData.enabled });
            }
            return [
              ...old,
              {
                createdAt: new Date(),
                enabled: newData.enabled,
                modelId: newData.modelId,
                updatedAt: new Date(),
                userId: "",
              },
            ];
          }
        );
        return { prev };
      },
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey });
      },
    })
  );

  const enabledModelsSet = useMemo(() => {
    const enabled: Set<string> = getDefaultEnabledModels(allModels);
    for (const pref of preferences ?? []) {
      if (pref.enabled) {
        enabled.add(pref.modelId);
      } else {
        enabled.delete(pref.modelId);
      }
    }
    return enabled;
  }, [allModels, preferences]);

  // Stable sort order: computed once on initial load, never changes
  const initialSortRef = useRef<AppModelId[] | null>(null);
  const sortedModels = useMemo(() => {
    if (initialSortRef.current === null) {
      // First render: enabled models first, then the rest
      const enabledSet = new Set(
        enabledModels.map((model: { readonly id: string }) => model.id)
      );
      const sorted = [
        ...enabledModels,
        ...allModels.filter(
          (model: { readonly id: string }) => !enabledSet.has(model.id)
        ),
      ];
      initialSortRef.current = sorted.map(
        (model: { readonly id: string }) => model.id
      );
      return sorted;
    }
    // Subsequent renders: maintain original order
    const modelMap = new Map(allModels.map((model) => [model.id, model]));
    // oxlint-disable-next-line react/refs -- Read the stable ordering captured on first render.
    return initialSortRef.current
      .map((id) => modelMap.get(id))
      .filter((model) => model !== undefined);
  }, [allModels, enabledModels, initialSortRef]);

  const filteredModels = useMemo(() => {
    if (!search.trim()) {
      return sortedModels;
    }
    const query = search.toLowerCase();
    return sortedModels.filter(
      (model: {
        readonly name: { readonly toLowerCase: () => string };
        readonly owned_by: { readonly toLowerCase: () => string };
        readonly id: { readonly toLowerCase: () => string };
      }) =>
        model.name.toLowerCase().includes(query) ||
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading toLowerCase from model.owned_by; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
        model.owned_by?.toLowerCase().includes(query) ||
        model.id.toLowerCase().includes(query)
    );
  }, [sortedModels, search]);

  const handleToggle = useCallback(
    (modelId: string, currentlyEnabled: boolean) => {
      setModelEnabled({
        enabled: !currentlyEnabled,
        modelId,
      });
    },
    [setModelEnabled]
  );

  if (prefsLoading) {
    return (
      <div className="animate-pulse space-y-1">
        {[1, 2, 3, 4, 5].map((placeholderId): React.JSX.Element => (
          <div className="bg-muted/50 h-11 rounded" key={placeholderId} />
        ))}
      </div>
    );
  }

  return (
    <>
      <p className="text-muted-foreground mb-2 text-xs">
        {filteredModels.length} model{filteredModels.length !== 1 && "s"}
      </p>
      <Table
        // oxlint-disable-next-line react/forbid-component-props -- Table accepts className in its styling contract; preserve this caller's layout and appearance.
        className={className}
      >
        <TableBody>
          {filteredModels.map((model): React.JSX.Element => (
            <ModelRow
              isEnabled={enabledModelsSet.has(model.id)}
              key={model.id}
              model={model}
              onToggle={handleToggle}
            />
          ))}
        </TableBody>
      </Table>

      {filteredModels.length === 0 && (
        <p className="text-muted-foreground py-8 text-center text-sm">
          No models found.
        </p>
      )}
    </>
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, react/jsx-max-depth */
