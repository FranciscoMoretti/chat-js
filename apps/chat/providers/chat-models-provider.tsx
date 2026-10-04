"use client";

import { useQuery } from "@tanstack/react-query";
import React, { createContext, useCallback, useContext, useMemo } from "react";
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

/* oxlint-disable no-undefined --
 * no-undefined (#519): ChatModelsContext uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
const ChatModelsContext = createContext<ChatModelsContextType | undefined>(
  undefined
);
/* oxlint-enable no-undefined */

/* oxlint-disable max-lines-per-function, typescript/prefer-readonly-parameter-types -- max-lines-per-function (#510): ChatModelsProvider keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
typescript/prefer-readonly-parameter-types (#565): ChatModelsProvider accepts { children, models, }: { children: ReactNode; models: AppModelDefinition[]; }; model; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
const ChatModelsProvider = ({
  children,
  models,
}: {
  children: ReactNode;
  models: AppModelDefinition[];
}): React.JSX.Element => {
  const trpc = useTRPC();
  const { data: session } = useSession();
  const isAuthenticated = Boolean(session?.user);

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
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: Persisted model preference IDs are reconciled with the installed catalog; stronger branding requires changing the preference and gateway contracts together.
        enabled.add(pref.modelId as AppModelId);
      } else {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: Persisted model preference IDs are reconciled with the installed catalog; stronger branding requires changing the preference and gateway contracts together.
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
/* oxlint-enable max-lines-per-function, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- no-undefined (#519): useChatModels uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 splitting exports requires an API and Fast Refresh boundary decision.
typescript/explicit-function-return-type (#560): Keep useChatModels's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep useChatModels's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary. */
const useChatModels = () => {
  const context = useContext(ChatModelsContext);
  if (context === undefined) {
    throw new Error("useChatModels must be used within a ChatModelsProvider");
  }
  return context;
};
/* oxlint-enable no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
/* oxlint-disable react/only-export-components -- #620: Consumers import ChatModelsProvider, useChatModels from this existing mixed component, context, or helper API; separating the Fast Refresh boundary remains tracked review debt. */
export { ChatModelsProvider, useChatModels };
/* oxlint-enable react/only-export-components */
