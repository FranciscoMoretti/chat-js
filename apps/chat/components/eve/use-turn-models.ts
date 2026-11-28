"use client";

import { hasText } from "@/components/text-value";
import { useState } from "react";
import type { SelectedModelValue } from "@/lib/ai/types";
import {
  useDefaultModel,
  useModelChange,
} from "@/providers/default-model-provider";

export const useTurnModels = (
  selectedModelIds: (selection: SelectedModelValue) => string[]
) => {
  const defaultModel = useDefaultModel();
  const changeModel = useModelChange();
  const [selection, setSelection] = useState<SelectedModelValue>();
  const value = selection ?? defaultModel;
  return {
    modelIds: selectedModelIds(value),
    setTurnSelection: setSelection,
    modelSelection: {
      value,
      onChange: async (next: SelectedModelValue) => {
        setSelection(next);
        const [primary] = selectedModelIds(next);
        if (hasText(primary)) {
          await changeModel(primary);
        }
      },
    },
  };
};
