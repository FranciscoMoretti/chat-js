"use client";

import { ModelSelector } from "@/components/model-selector";
import { useChatModels } from "@/providers/chat-models-provider";
import {
  useDefaultModel,
  useModelChange,
} from "@/providers/default-model-provider";

export function EveModelPicker({
  disabled = false,
  retainedModelId,
}: {
  disabled?: boolean;
  retainedModelId?: string;
}) {
  const defaultModel = useDefaultModel();
  const changeModel = useModelChange();
  const { getModelById } = useChatModels();
  const selectedModel =
    (retainedModelId && getModelById(retainedModelId)?.id) || defaultModel;
  return (
    <fieldset disabled={disabled}>
      <ModelSelector
        allowMultiple={false}
        onModelSelectionChangeAction={async (selection) => {
          const model =
            typeof selection === "string" ? getModelById(selection) : undefined;
          if (model) {
            await changeModel(model.id);
          }
        }}
        selectedModelId={selectedModel}
        selectedModelSelection={selectedModel}
      />
    </fieldset>
  );
}
