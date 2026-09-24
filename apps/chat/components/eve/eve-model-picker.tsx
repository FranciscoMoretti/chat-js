"use client";

import { ModelSelector } from "@/components/model-selector";
import { getPrimarySelectedModelId } from "@/lib/ai/types";
import type { SelectedModelValue } from "@/lib/ai/types";
import { useChatModels } from "@/providers/chat-models-provider";
import {
  useDefaultModel,
  useModelChange,
} from "@/providers/default-model-provider";

export const EveModelPicker = ({
  disabled = false,
  retainedModelId,
  retainedModelIds,
  modelSelection,
}: {
  disabled?: boolean;
  retainedModelId?: string;
  retainedModelIds?: string[];
  modelSelection?: {
    value: SelectedModelValue;
    onChange: (value: SelectedModelValue) => Promise<void>;
  };
}) => {
  const defaultModel = useDefaultModel();
  const changeModel = useModelChange();
  const { getModelById } = useChatModels();
  if (retainedModelIds) {
    const names = retainedModelIds
      .map((id) => getModelById(id)?.name ?? id)
      .join(", ");
    return (
      <span className="inline-flex h-8 items-center px-2 text-sm" title={names}>
        {retainedModelIds.length} models
      </span>
    );
  }
  const selectedModel =
    (retainedModelId && getModelById(retainedModelId)?.id) ||
    getPrimarySelectedModelId(modelSelection?.value) ||
    defaultModel;
  return (
    <fieldset disabled={disabled}>
      <ModelSelector
        className="h-8 w-fit max-w-none shrink justify-start truncate px-2 text-xs @[500px]:h-10 @[500px]:px-3 @[500px]:text-sm"
        allowMultiple={!!modelSelection}
        onModelSelectionChangeAction={async (selection) => {
          if (modelSelection) {
            await modelSelection.onChange(selection);
            return;
          }
          const model =
            typeof selection === "string" ? getModelById(selection) : undefined;
          if (model) {
            await changeModel(model.id);
          }
        }}
        selectedModelId={selectedModel}
        selectedModelSelection={modelSelection?.value ?? selectedModel}
      />
    </fieldset>
  );
};
