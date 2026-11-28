"use client";

import React from "react";
import { useOptimisticModelSelection } from "@/components/use-optimistic-model-selection";
import { ModelSelector } from "@/components/model-selector";
import {
  useDefaultModel,
  useModelChange,
} from "@/providers/default-model-provider";

/** The default composer chooses one model. Other selection modes supply a slot. */
export const EveModelPicker = ({
  disabled = false,
  fallbackModelName,
  modelId,
  onModelChange,
}: {
  readonly disabled?: boolean;
  readonly fallbackModelName?: string;
  readonly modelId?: string;
  readonly onModelChange?: (value: string) => void | Promise<void>;
}): React.JSX.Element => {
  const defaultModel = useDefaultModel();
  const changeModel = useModelChange();
  const { selection: selected, change } = useOptimisticModelSelection(
    modelId ?? defaultModel,
    onModelChange ?? changeModel
  );
  return (
    <fieldset disabled={disabled}>
      <ModelSelector
        className="h-8 w-fit max-w-none shrink justify-start truncate px-2 text-xs @[500px]:h-10 @[500px]:px-3 @[500px]:text-sm"
        fallbackModelName={fallbackModelName}
        selectedModelId={selected}
        onModelSelectionChangeAction={change}
      />
    </fieldset>
  );
};
