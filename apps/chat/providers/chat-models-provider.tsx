"use client";

import React, { createContext, useCallback, useContext, useMemo } from "react";
import type { AppModelDefinition } from "@/lib/ai/app-models";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
import { useQuery } from "@tanstack/react-query";
// oxlint-disable-next-line sort-imports -- Query initializes its host-dependent managers before app-models validates config at module load; sorting these singles reverses initialization and error order. React already evaluates first through QueryClientProvider.
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

/* oxlint-disable no-undefined --
 * no-undefined (#519): ChatModelsContext uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
const ChatModelsContext = createContext<ChatModelsContextType | undefined>(
  undefined
);
/* oxlint-enable no-undefined */

/* oxlint-disable max-lines-per-function -- max-lines-per-function (#510): ChatModelsProvider keeps its ordered workflow and input contract together; models: AppModelDefinition[]; }; model; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */

const ChatModelsProvider = ({
  children,
  models,
}: {
  readonly children: ReadonlyReactNode;
  readonly models: readonly ReadonlyNativeSurface<AppModelDefinition>[];
}): React.JSX.Element => {
  const trpc = useTRPC();
  const { data: session } = useSession();
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading user from session; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  const isAuthenticated = Boolean(session?.user);

  const { data: preferences } = useQuery({
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing trpc.settings.getModelPreferences.queryOptions() own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
/* oxlint-enable max-lines-per-function */

/* oxlint-disable no-undefined -- no-undefined (#519): useChatModels uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */

const useChatModels = (): ChatModelsContextType => {
  const context = useContext(ChatModelsContext);
  if (context === undefined) {
    throw new Error("useChatModels must be used within a ChatModelsProvider");
  }
  return context;
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (ChatModelsProvider, useChatModels); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable no-undefined */
/* oxlint-disable react/only-export-components -- #620: Consumers import ChatModelsProvider, useChatModels from this existing mixed component, context, or helper API; separating the Fast Refresh boundary remains tracked review debt. */
export { ChatModelsProvider, useChatModels };
/* oxlint-enable import/no-named-export */
/* oxlint-enable react/only-export-components */
