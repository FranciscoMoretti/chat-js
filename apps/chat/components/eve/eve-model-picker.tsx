"use client";

import React from "react";
import { ModelSelector } from "@/components/model-selector";
import {
  useDefaultModel,
  useModelChange,
} from "@/providers/default-model-provider";

/** The default composer chooses one model. Other selection modes supply a slot. */
export const EveModelPicker = ({
  disabled = false,
  modelId,
}: {
  readonly disabled?: boolean;
  readonly modelId?: string;
}): React.JSX.Element => {
  const defaultModel = useDefaultModel();
  const changeModel = useModelChange();
  const selected = modelId ?? defaultModel;
  return (
    <fieldset disabled={disabled}>
      <ModelSelector
        className="h-8 w-fit max-w-none shrink justify-start truncate px-2 text-xs @[500px]:h-10 @[500px]:px-3 @[500px]:text-sm"
        selectedModelId={selected}
        selectedModelSelection={selected}
        onModelSelectionChangeAction={async (selection) => {
          if (typeof selection === "string") {
            await changeModel(selection);
          }
        }}
      />
    </fieldset>
  );
};
