"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { JSX as ReactJSX } from "react";

import { toast } from "sonner";

import { Table, TableBody } from "@/components/ui/table";

import type { AppModelId } from "@/lib/ai/app-model-id";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import { getDefaultEnabledModels } from "@/lib/ai/app-models";
import { useChatModels } from "@/providers/chat-models-provider";
import { ModelRow } from "./model-row";

import { useTRPC } from "@/trpc/react";

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
        context: { readonly prev: typeof preferences } | undefined
      ) => {
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

  // Capture the initial enabled-first ordering for this table's lifetime.

  // oxlint-disable-next-line react/hook-use-state -- models-table.browser proves initial ordering survives preference updates and resets only on remount; this intentionally immutable mounted snapshot needs no setter.
  const [initialSort] = useState<readonly AppModelId[]>(() => {
    const enabledSet = new Set(
      enabledModels.map((model: { readonly id: AppModelId }) => model.id)
    );
    return [
      ...enabledModels.map((model: { readonly id: AppModelId }) => model.id),
      ...allModels
        .filter(
          (model: { readonly id: AppModelId }) => !enabledSet.has(model.id)
        )
        .map((model: { readonly id: AppModelId }) => model.id),
    ];
  });
  const sortedModels = useMemo(() => {
    const modelMap = new Map(
      allModels.map(
        (model: ReadonlyNativeSurface<(typeof allModels)[number]>) => [
          model.id,
          model,
        ]
      )
    );
    return initialSort
      .map((id) => modelMap.get(id))
      .filter((model) => model !== undefined);
  }, [allModels, initialSort]);

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
      <Table className={className}>
        <TableBody>
          {filteredModels.map(
            (
              model: ReadonlyNativeSurface<(typeof allModels)[number]>
            ): React.JSX.Element => (
              <ModelRow
                isEnabled={enabledModelsSet.has(model.id)}
                key={model.id}
                model={model}
                onToggle={handleToggle}
              />
            )
          )}
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
