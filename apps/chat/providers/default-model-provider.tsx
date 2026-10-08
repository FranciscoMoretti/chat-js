"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { AppModelId } from "@/lib/ai/app-models";
// oxlint-disable-next-line sort-imports -- This type-only rendering view follows the existing runtime import group.
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";

/* oxlint-enable sort-imports */

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
  readonly children: ReadonlyReactNode;
  readonly defaultModel: AppModelId;
}

/* oxlint-disable no-console -- no-console (#514): DefaultModelProvider emits operational command/error diagnostics through console; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */

const DefaultModelProvider = ({
  children,
  defaultModel: initialModel,
}: DefaultModelClientProviderProps): React.JSX.Element => {
  const [currentModel, setCurrentModel] = useState<AppModelId>(initialModel);

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve changeModel's awaited sequencing and rejected-Promise behavior. */
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
  /* oxlint-enable oxc/no-async-await */
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
/* oxlint-enable no-console */

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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (DefaultModelProvider, useDefaultModel, useModelChange); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
/* oxlint-disable react/only-export-components -- #620: Consumers import DefaultModelProvider, useDefaultModel, useModelChange from this existing mixed component, context, or helper API; separating the Fast Refresh boundary remains tracked review debt. */
export { DefaultModelProvider, useDefaultModel, useModelChange };
/* oxlint-enable import/no-named-export */
/* oxlint-enable react/only-export-components */
