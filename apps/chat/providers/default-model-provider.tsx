"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import type { AppModelId } from "@/lib/ai/app-models";

interface DefaultModelContextType {
  changeModel: (modelId: AppModelId) => Promise<void>;
  defaultModel: AppModelId;
}

/* oxlint-disable no-undefined --
 * no-undefined (#519): DefaultModelContext uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
const DefaultModelContext = createContext<DefaultModelContextType | undefined>(
  undefined
);
/* oxlint-enable no-undefined */

interface DefaultModelClientProviderProps {
  children: ReactNode;
  defaultModel: AppModelId;
}

/* oxlint-disable no-console, typescript/prefer-readonly-parameter-types -- no-console (#514): DefaultModelProvider emits operational command/error diagnostics through console; selecting another logging transport requires a runtime-specific decision.
typescript/prefer-readonly-parameter-types (#565): DefaultModelProvider accepts { children, defaultModel: initialModel, }: DefaultModelClientProviderProps; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
const DefaultModelProvider = ({
  children,
  defaultModel: initialModel,
}: DefaultModelClientProviderProps): React.JSX.Element => {
  const [currentModel, setCurrentModel] = useState<AppModelId>(initialModel);

  const changeModel = useCallback(
    async (modelId: AppModelId) => {
      // Update local state immediately
      setCurrentModel(modelId);

      try {
        // Update cookies for persistence
        await fetch("/api/chat-model", {
          body: JSON.stringify({ model: modelId }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });
      } catch (error) {
        console.error("Failed to save chat model:", error);
        toast.error("Failed to save model preference");
        // Revert on error
        setCurrentModel(initialModel);
      }
    },
    [initialModel]
  );

  const value = useMemo(
    () => ({
      changeModel,
      defaultModel: currentModel,
    }),
    [currentModel, changeModel]
  );

  return (
    <DefaultModelContext.Provider value={value}>
      {children}
    </DefaultModelContext.Provider>
  );
};
/* oxlint-enable no-console, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- no-undefined (#519): useDefaultModel uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 splitting exports requires an API and Fast Refresh boundary decision.
typescript/explicit-function-return-type (#560): Keep useDefaultModel's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep useDefaultModel's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary. */
const useDefaultModel = () => {
  const context = useContext(DefaultModelContext);
  if (context === undefined) {
    throw new Error(
      "useDefaultModel must be used within a DefaultModelProvider"
    );
  }
  return context.defaultModel;
};
/* oxlint-enable no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */

/* oxlint-disable no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- no-undefined (#519): useModelChange uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 splitting exports requires an API and Fast Refresh boundary decision.
typescript/explicit-function-return-type (#560): Keep useModelChange's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep useModelChange's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary. */
const useModelChange = () => {
  const context = useContext(DefaultModelContext);
  if (context === undefined) {
    throw new Error(
      "useModelChange must be used within a DefaultModelProvider"
    );
  }
  return context.changeModel;
};
/* oxlint-enable no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
/* oxlint-disable react/only-export-components -- #620: Consumers import DefaultModelProvider, useDefaultModel, useModelChange from this existing mixed component, context, or helper API; separating the Fast Refresh boundary remains tracked review debt. */
export { DefaultModelProvider, useDefaultModel, useModelChange };
/* oxlint-enable react/only-export-components */
