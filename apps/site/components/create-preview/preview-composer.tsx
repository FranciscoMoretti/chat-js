"use client";

import type { ComponentProps } from "react";
import { EveComposer } from "../../../chat/components/eve/eve-composer";
import { TurnModelPicker } from "../../../chat/components/eve/turn-model-picker";
import { ParallelResponseModelPicker } from "../../../chat/chatjs/plugins/parallel-responses/model-picker";
import { useDefaultModel } from "../../../chat/providers/default-model-provider";
import { selectedModelIds } from "../../../chat/chatjs/plugins/parallel-responses/selected-model-ids";
import type { TurnModelPickerProps } from "../../../chat/chatjs/core/chat/turn-model-picker";
import type { composerPickerChoice } from "../../../../packages/registry/installation";

export const previewTurnSelection = (
  choice: ReturnType<typeof composerPickerChoice>,
  value: TurnModelPickerProps["value"],
  defaultModel: string
) =>
  choice === "parallel" || (choice === "single" && typeof value === "string")
    ? value
    : defaultModel;

/** Preview choices render the same picker components as the generated app. */
export const PreviewComposer = ({
  onSubmit,
  choice,
  value,
  onChange,
  ...props
}: Omit<ComponentProps<typeof EveComposer>, "onSubmit"> &
  Pick<TurnModelPickerProps, "value" | "onChange"> & {
    readonly choice: ReturnType<typeof composerPickerChoice>;
    readonly onSubmit: (modelIds: readonly string[]) => void;
  }) => {
  const Picker =
    choice === "parallel" ? ParallelResponseModelPicker : TurnModelPicker;
  const defaultModel = useDefaultModel();
  const selection = previewTurnSelection(choice, value, defaultModel);
  const modelIds = selectedModelIds(selection);
  return (
    <EveComposer
      {...props}
      modelIds={modelIds}
      onSubmit={() => {
        onSubmit(modelIds);
      }}
      modelPicker={
        choice === "none" ? null : (
          <Picker
            disabled={props.disabled}
            value={selection}
            onChange={onChange}
          />
        )
      }
    />
  );
};
