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

/* oxlint-disable import/group-exports, no-console, typescript/prefer-readonly-parameter-types --
 * import/group-exports (#523): DefaultModelProvider stays exported at its declaration so its public contract is visible beside its implementation.
 * no-console (#514): DefaultModelProvider emits operational command/error diagnostics through console; selecting another logging transport requires a runtime-specific decision.
 * typescript/prefer-readonly-parameter-types (#565): DefaultModelProvider accepts { children, defaultModel: initialModel, }: DefaultModelClientProviderProps; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const DefaultModelProvider = ({
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
/* oxlint-enable import/group-exports, no-console, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, no-undefined, react/only-export-components, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types --
 * import/group-exports (#523): useDefaultModel stays exported at its declaration so its public contract is visible beside its implementation.
 * no-undefined (#519): useDefaultModel uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * react/only-export-components (#553): useDefaultModel is part of a module that also exposes related helpers or framework data; splitting exports requires an API and Fast Refresh boundary decision.
 * typescript/explicit-function-return-type (#560): Keep useDefaultModel's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep useDefaultModel's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
export const useDefaultModel = () => {
  const context = useContext(DefaultModelContext);
  if (context === undefined) {
    throw new Error(
      "useDefaultModel must be used within a DefaultModelProvider"
    );
  }
  return context.defaultModel;
};
/* oxlint-enable import/group-exports, no-undefined, react/only-export-components, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */

/* oxlint-disable import/group-exports, no-undefined, react/only-export-components, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types --
 * import/group-exports (#523): useModelChange stays exported at its declaration so its public contract is visible beside its implementation.
 * no-undefined (#519): useModelChange uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * react/only-export-components (#553): useModelChange is part of a module that also exposes related helpers or framework data; splitting exports requires an API and Fast Refresh boundary decision.
 * typescript/explicit-function-return-type (#560): Keep useModelChange's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep useModelChange's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
export const useModelChange = () => {
  const context = useContext(DefaultModelContext);
  if (context === undefined) {
    throw new Error(
      "useModelChange must be used within a DefaultModelProvider"
    );
  }
  return context.changeModel;
};
/* oxlint-enable import/group-exports, no-undefined, react/only-export-components, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
