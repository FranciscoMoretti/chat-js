"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";

import { Table, TableBody } from "@/components/ui/table";
import type { AppModelId } from "@/lib/ai/app-model-id";
import { getDefaultEnabledModels } from "@/lib/ai/app-models";
import { useChatModels } from "@/providers/chat-models-provider";
import { useTRPC } from "@/trpc/react";

import { ModelRow } from "./model-row";

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
      onMutate: (newData) => {
        const prev = queryClient.getQueryData(queryKey);
        queryClient.setQueryData(queryKey, (old: typeof preferences) => {
          if (!old) {
            return old;
          }
          const idx = old.findIndex((p) => p.modelId === newData.modelId);
          if (idx >= 0) {
            return old.with(idx, { ...old[idx], enabled: newData.enabled });
          }
          return [
            ...old,
            {
              modelId: newData.modelId,
              enabled: newData.enabled,
              userId: "",
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ];
        });
        return { prev };
      },
      onError: (_err, _newData, context) => {
        queryClient.setQueryData(queryKey, context?.prev);
        toast.error("Failed to update model preference");
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey });
      },
    })
  );

  const enabledModelsSet = useMemo(() => {
    const enabled = getDefaultEnabledModels(allModels);
    for (const pref of preferences ?? []) {
      if (pref.enabled) {
        enabled.add(pref.modelId as AppModelId);
      } else {
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
    return initialSortRef.current
      .map((id) => modelMap.get(id))
      .filter((m) => m !== undefined);
  }, [allModels, enabledModels]);

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
        {[1, 2, 3, 4, 5].map((i) => (
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
          {filteredModels.map((model) => (
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
