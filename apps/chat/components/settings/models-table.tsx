"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";

import { Table, TableBody } from "@/components/ui/table";
import type { AppModelId } from "@/lib/ai/app-model-id";
import { getDefaultEnabledModels } from "@/lib/ai/app-models";
import { useChatModels } from "@/providers/chat-models-provider";
import { useTRPC } from "@/trpc/react";

import { ModelRow } from "./model-row";
/* oxlint-disable id-length, max-lines-per-function, max-statements, no-magic-numbers, no-undefined, react/jsx-max-depth, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- ModelsTable: id-length: retain conventional event, index, and generic identifiers in this existing callback contract; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including -1); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including _err). */

export const ModelsTable = ({
  search,
  className,
}: {
  search: string;
  className?: string;
}) => {
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
          const idx = old.findIndex((p) => p.modelId === newData.modelId);
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
    const enabled = getDefaultEnabledModels(allModels);
    for (const pref of preferences ?? []) {
      if (pref.enabled) {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: Preference IDs originate from the catalog-backed settings API; replacing the assertion requires migrating persisted model-ID types.
        enabled.add(pref.modelId as AppModelId);
      } else {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: Preference IDs originate from the catalog-backed settings API; replacing the assertion requires migrating persisted model-ID types.
        enabled.delete(pref.modelId as AppModelId);
      }
    }
    return enabled;
  }, [allModels, preferences]);

  // Stable sort order: computed once on initial load, never changes
  const initialSortRef = useRef<AppModelId[] | null>(null);
  const sortedModels = useMemo(() => {
    if (initialSortRef.current === null) {
      // First render: enabled models first, then the rest
      const enabledSet = new Set(enabledModels.map((m) => m.id));
      const sorted = [
        ...enabledModels,
        ...allModels.filter((m) => !enabledSet.has(m.id)),
      ];
      initialSortRef.current = sorted.map((m) => m.id);
      return sorted;
    }
    // Subsequent renders: maintain original order
    const modelMap = new Map(allModels.map((m) => [m.id, m]));
    // oxlint-disable-next-line react/refs -- Read the stable ordering captured on first render.
    return initialSortRef.current
      .map((id) => modelMap.get(id))
      .filter((m) => m !== undefined);
  }, [allModels, enabledModels, initialSortRef]);

  const filteredModels = useMemo(() => {
    if (!search.trim()) {
      return sortedModels;
    }
    const q = search.toLowerCase();
    return sortedModels.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.owned_by?.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q)
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
        {[1, 2, 3, 4, 5].map((i): React.JSX.Element => (
          <div className="bg-muted/50 h-11 rounded" key={i} />
        ))}
      </div>
    );
  }

  return (
    <>
      <p className="text-muted-foreground mb-2 text-xs">
        {filteredModels.length} model{filteredModels.length !== 1 && "s"}
      </p>
      <Table className={className}>
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
/* oxlint-enable id-length, max-lines-per-function, max-statements, no-magic-numbers, no-undefined, react/jsx-max-depth, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
