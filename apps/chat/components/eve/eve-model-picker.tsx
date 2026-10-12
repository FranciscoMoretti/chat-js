"use client";

import { hasText, nonEmptyText } from "@/components/text-value";

import React from "react";
import type { JSX as ReactJSX } from "react";

import { ModelSelector } from "@/components/model-selector";
import type { SelectedModelValue } from "@/lib/ai/types";
import { getPrimarySelectedModelId } from "@/lib/ai/types";
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
  readonly disabled?: boolean;
  readonly retainedModelId?: string;
  readonly retainedModelIds?: readonly string[];
  readonly modelSelection?: {
    readonly value: SelectedModelValue;
    readonly onChange: (value: SelectedModelValue) => Promise<void>;
  };
}): ReactJSX.Element => {
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
    nonEmptyText(
      hasText(retainedModelId) ? getModelById(retainedModelId)?.id : undefined
    ) ??
    nonEmptyText(getPrimarySelectedModelId(modelSelection?.value)) ??
    defaultModel;
  return (
    <fieldset disabled={disabled}>
      <ModelSelector
        className="h-8 w-fit max-w-none shrink justify-start truncate px-2 text-xs @[500px]:h-10 @[500px]:px-3 @[500px]:text-sm"
        allowMultiple={Boolean(modelSelection)}

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
