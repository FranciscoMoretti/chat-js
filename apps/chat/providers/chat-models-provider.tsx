"use client";

import React, { createContext, useCallback, useContext, useMemo } from "react";
import type { AppModelDefinition } from "@/lib/ai/app-models";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
import { useQuery } from "@tanstack/react-query";
import { getDefaultEnabledModels } from "@/lib/ai/app-models";
import { useSession } from "@/providers/session-provider";
import { useTRPC } from "@/trpc/react";

interface ChatModelsContextType {
  readonly allModels: readonly ReadonlyNativeSurface<AppModelDefinition>[];
  readonly getModelById: (
    modelId: string
  ) => ReadonlyNativeSurface<AppModelDefinition> | undefined;
  readonly models: readonly ReadonlyNativeSurface<AppModelDefinition>[];
}

const ChatModelsContext = createContext<ChatModelsContextType | undefined>(
  undefined
);

const ChatModelsProvider = ({
  children,
  models,
}: {
  readonly children: ReadonlyReactNode;
  readonly models: readonly ReadonlyNativeSurface<AppModelDefinition>[];
}): React.JSX.Element => {
  const trpc = useTRPC();
  const { data: session } = useSession();
  const isAuthenticated = Boolean(session?.user);

  const { data: preferences } = useQuery({
    ...trpc.settings.getModelPreferences.queryOptions(),
    enabled: isAuthenticated,
  });

  const allModelsMap = useMemo(() => {
    const map = new Map<string, ReadonlyNativeSurface<AppModelDefinition>>();
    for (const model of models) {
      map.set(model.id, model);
    }
    return map;
  }, [models]);

  const enabledModelsSet = useMemo(() => {
    const enabled = getDefaultEnabledModels(models);
    for (const pref of preferences ?? []) {
      if (pref.enabled) {
        enabled.add(pref.modelId);
      } else {
        enabled.delete(pref.modelId);
      }
    }
    return enabled;
  }, [models, preferences]);

  const filteredModels = useMemo(
    () =>
      models.filter((model: Readonly<Pick<AppModelDefinition, "id">>) =>
        enabledModelsSet.has(model.id)
      ),
    [models, enabledModelsSet]
  );

  const getModelById = useCallback(
    (modelId: string) => allModelsMap.get(modelId),
    [allModelsMap]
  );
  const contextValue = useMemo(
    () => ({ allModels: models, getModelById, models: filteredModels }),
    [filteredModels, getModelById, models]
  );

  return (
    <ChatModelsContext.Provider value={contextValue}>
      {children}
    </ChatModelsContext.Provider>
  );
};

const useChatModels = (): ChatModelsContextType => {
  const context = useContext(ChatModelsContext);
  if (context === undefined) {
    throw new Error("useChatModels must be used within a ChatModelsProvider");
  }
  return context;
};
export { ChatModelsProvider, useChatModels };
