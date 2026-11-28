"use client";

import type { JSX } from "react";
import type { TurnModelPickerProps } from "@/chatjs/core/chat/turn-model-picker";
import { selectedModelIds } from "@/lib/eve/default-turn-models";
import { useDefaultModel } from "@/providers/default-model-provider";
import { ModelSelector } from "@/chatjs/ui/model-selector/model-selector";
import { useOptimisticModelSelection } from "@/chatjs/ui/model-selector/use-optimistic-model-selection";

export const TurnModelPicker = ({
  disabled,
  value,
  onChange,
  retainedModelId,
  fallbackModelName,
}: TurnModelPickerProps): JSX.Element => {
  const defaultModel = useDefaultModel();
  const { selection, change } = useOptimisticModelSelection(value, onChange);
  return (
    <fieldset disabled={disabled}>
      <ModelSelector
        className="h-8 w-fit max-w-none shrink justify-start truncate px-2 text-xs @[500px]:h-10 @[500px]:px-3 @[500px]:text-sm"
        fallbackModelName={fallbackModelName ?? retainedModelId}
        selectedModelId={
          retainedModelId ?? selectedModelIds(selection)[0] ?? defaultModel
        }
        onModelSelectionChangeAction={change}
      />
    </fieldset>
  );
};
