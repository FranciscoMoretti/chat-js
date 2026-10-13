"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { AppModelId } from "@/lib/ai/app-models";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
import { toast } from "sonner";

interface DefaultModelContextType {
  changeModel: (modelId: AppModelId) => Promise<void>;
  defaultModel: AppModelId;
}

const DefaultModelContext = createContext<DefaultModelContextType | undefined>(
  undefined
);

interface DefaultModelClientProviderProps {
  readonly children: ReadonlyReactNode;
  readonly defaultModel: AppModelId;
}

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

const useDefaultModel = (): AppModelId => {
  const context = useContext(DefaultModelContext);
  if (context === undefined) {
    throw new Error(
      "useDefaultModel must be used within a DefaultModelProvider"
    );
  }
  return context.defaultModel;
};

const useModelChange = (): DefaultModelContextType["changeModel"] => {
  const context = useContext(DefaultModelContext);
  if (context === undefined) {
    throw new Error(
      "useModelChange must be used within a DefaultModelProvider"
    );
  }
  return context.changeModel;
};
export { DefaultModelProvider, useDefaultModel, useModelChange };
