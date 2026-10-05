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
import { useChatModels } from "@/providers/chat-models-provider";
import { useTRPC } from "@/trpc/react";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { ModelRow } from "./model-row";
/* oxlint-disable react/jsx-no-literals -- ModelsTable renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-enable sort-imports */
/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, react/jsx-max-depth, typescript/prefer-readonly-parameter-types -- ModelsTable: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including -1); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including _err). */

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
        _err,
        _newData,
        context: { prev: typeof preferences } | undefined
      ) => {
        queryClient.setQueryData(queryKey, context?.prev);
        toast.error("Failed to update model preference");
      },
      onMutate: (newData) => {
        const prev = queryClient.getQueryData(queryKey);
        queryClient.setQueryData(queryKey, (old: typeof preferences) => {
          if (!old) {
            return old;
          }
          const idx = old.findIndex(
            (preference) => preference.modelId === newData.modelId
          );
          if (idx !== -1) {
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
        });
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
      const enabledSet = new Set(enabledModels.map((model) => model.id));
      const sorted = [
        ...enabledModels,
        ...allModels.filter((model) => !enabledSet.has(model.id)),
      ];
      initialSortRef.current = sorted.map((model) => model.id);
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
      (model) =>
        model.name.toLowerCase().includes(query) ||
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
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, react/jsx-max-depth, typescript/prefer-readonly-parameter-types */
