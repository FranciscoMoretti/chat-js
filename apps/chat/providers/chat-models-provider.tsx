"use client";

import { useQuery } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo } from "react";
import type { ReactNode } from "react";

import type { AppModelId } from "@/lib/ai/app-model-id";
import { getDefaultEnabledModels } from "@/lib/ai/app-models";
import type { AppModelDefinition } from "@/lib/ai/app-models";
import { useSession } from "@/providers/session-provider";
import { useTRPC } from "@/trpc/react";

interface ChatModelsContextType {
  allModels: AppModelDefinition[];
  getModelById: (modelId: string) => AppModelDefinition | undefined;
  models: AppModelDefinition[];
}

const ChatModelsContext = createContext<ChatModelsContextType | undefined>(
  undefined
);

export const ChatModelsProvider = ({
  children,
  models,
}: {
  children: ReactNode;
  models: AppModelDefinition[];
}) => {
  const trpc = useTRPC();
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;

  const { data: preferences } = useQuery({
    ...trpc.settings.getModelPreferences.queryOptions(),
    enabled: isAuthenticated,
  });

  const allModelsMap = useMemo(() => {
    const map = new Map<string, AppModelDefinition>();
    for (const model of models) {
      map.set(model.id, model);
    }
    return map;
  }, [models]);

  const enabledModelsSet = useMemo(() => {
    const enabled = getDefaultEnabledModels(models);
    for (const pref of preferences ?? []) {
      if (pref.enabled) {
        enabled.add(pref.modelId as AppModelId);
      } else {
        enabled.delete(pref.modelId as AppModelId);
      }
    }
    return enabled;
  }, [models, preferences]);

  const filteredModels = useMemo(
    () => models.filter((model) => enabledModelsSet.has(model.id)),
    [models, enabledModelsSet]
  );

  const getModelById = useCallback(
    (modelId: string) => allModelsMap.get(modelId),
    [allModelsMap]
  );

  return (
    <ChatModelsContext.Provider
      value={{ allModels: models, getModelById, models: filteredModels }}
    >
      {children}
    </ChatModelsContext.Provider>
  );
};

export const useChatModels = () => {
  const context = useContext(ChatModelsContext);
  if (context === undefined) {
    throw new Error("useChatModels must be used within a ChatModelsProvider");
  }
  return context;
};
