"use client";

import React, { useId } from "react";
import { useOptimisticModelSelection } from "@/chatjs/ui/model-selector/use-optimistic-model-selection";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ModelSelectionIndicator } from "./model-selection-indicator";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

import type { TurnModelPickerProps } from "@/chatjs/core/chat/turn-model-picker";
import { ModelSelector } from "@/chatjs/ui/model-selector/model-selector";
import { config } from "@/lib/config";
import { selectedModelIds } from "./selected-model-ids";
import { useChatModels } from "@/providers/chat-models-provider";
import { useDefaultModel } from "@/providers/default-model-provider";

const stopEventPropagation = (event: {
  readonly stopPropagation: () => void;
}) => {
  event.stopPropagation();
};

const CountMenu = ({
  count,
  modelName,
  onCountChange,
}: {
  readonly count: number;
  readonly modelName: string;
  readonly onCountChange: (count: number) => void;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      aria-label={`${count}× ${modelName}`}
      className="bg-primary/15 text-foreground hover:bg-primary/25 me-2 flex w-10 shrink-0 items-center justify-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums"
      type="button"
      onClick={stopEventPropagation}
      onMouseDown={stopEventPropagation}
    >
      {count}×
      <ChevronDownIcon className="h-2.5 w-2.5" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" onKeyDown={stopEventPropagation}>
      <DropdownMenuGroup>
        {[1, 2, 3, 4].map((modelCount): React.JSX.Element => (
          <DropdownMenuItem
            key={modelCount}
            onClick={(event: { readonly stopPropagation: () => void }) => {
              event.stopPropagation();
              onCountChange(modelCount);
            }}
          >
            {modelCount}x
            {modelCount === count && <CheckIcon className="ml-auto h-3 w-3" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>
);

const MultipleModelsSetting = ({
  checked,
  onCheckedChange,
}: {
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
}): React.JSX.Element => {
  const id = useId();
  const descriptionId = `${id}-description`;
  return (
    <div className="space-y-1.5 border-b px-3 py-2">
      <div className="flex items-center justify-between">
        <Label className="cursor-pointer text-sm" htmlFor={id}>
          Use Multiple Models
        </Label>
        <Switch
          aria-describedby={checked ? descriptionId : undefined}
          checked={checked}
          id={id}
          onCheckedChange={onCheckedChange}
        />
      </div>
      {checked && (
        <p className="text-muted-foreground text-xs" id={descriptionId}>
          Each model replies in its own branch. Replies run one at a time and
          share workspace files.
        </p>
      )}
    </div>
  );
};

const renderSelectionIndicator = (selected: boolean) => (
  <ModelSelectionIndicator selected={selected} />
);

export const ParallelResponseModelPicker = ({
  disabled,
  fallbackModelName,
  retainedModelId,
  retainedModelIds,
  value,
  onChange,
}: TurnModelPickerProps): React.JSX.Element => {
  const { selection, change } = useOptimisticModelSelection(value, onChange);
  const defaultModel = useDefaultModel();
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
  const selected =
    retainedModelId ?? selectedModelIds(selection)[0] ?? defaultModel;
  const visibleSelection = retainedModelId ?? selection;
  const counts =
    typeof visibleSelection === "string" ? undefined : visibleSelection;
  const ids =
    counts && Object.keys(counts).filter((id) => (counts[id] ?? 0) > 0);
  const total = counts
    ? Object.values(counts).reduce<number>(
        (sum, count) => sum + (count ?? 0),
        0
      )
    : 0;
  const renderCount = (model: {
    readonly id: string;
    readonly name: string;
  }) => {
    const count = counts?.[model.id];
    if (count === undefined || count < 1) {
      return null;
    }
    return (
      <CountMenu
        count={count}
        modelName={model.name}
        onCountChange={(next) => {
          change({ ...counts, [model.id]: next });
        }}
      />
    );
  };
  return (
    <fieldset disabled={disabled}>
      <ModelSelector
        className="h-8 w-fit max-w-none shrink justify-start truncate px-2 text-xs @[500px]:h-10 @[500px]:px-3 @[500px]:text-sm"
        options={
          config.features.parallelResponses
            ? {
                header: (
                  <MultipleModelsSetting
                    checked={Boolean(counts)}
                    onCheckedChange={(checked) => {
                      change(checked ? { [selected]: 1 } : selected);
                    }}
                  />
                ),
                values: ids,
                onChange: (next) => {
                  change(
                    Object.fromEntries(
                      next.map((id) => [id, counts?.[id] ?? 1])
                    )
                  );
                },
                suffix: total > 1 ? ` +${total - 1}` : undefined,
                renderPrefix: counts ? renderSelectionIndicator : undefined,
                renderAction: counts ? renderCount : undefined,
              }
            : undefined
        }
        fallbackModelName={fallbackModelName ?? retainedModelId}
        onModelSelectionChangeAction={change}
        selectedModelId={selected}
      />
    </fieldset>
  );
};
