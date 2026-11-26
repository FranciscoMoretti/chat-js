"use client";

import type { getEnabledFeatures } from "@/lib/features-config";

import { Checkbox } from "@/components/ui/checkbox";
import { ModelSelectionIndicator } from "@/components/model-selection-indicator";
import { PopoverButton } from "@/components/popover-button";
import { nonEmptyText } from "@/components/text-value";
import type { AppModelDefinition, AppModelId } from "@/lib/ai/app-models";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  FilterIcon,
  SearchIcon,
} from "lucide-react";
import React, {
  memo,
  useCallback,
  useId,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
} from "react";

import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";

import { Combobox } from "@base-ui/react/combobox";
import { defaultFilter } from "cmdk";
import { InputGroup, InputGroupAddon } from "@/components/ui/input-group";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";

import { Popover, PopoverContent } from "@/components/ui/popover";

import type { SelectedModelCounts, SelectedModelValue } from "@/lib/ai/types";

import type { JSX as ReactJSX } from "react";

import { Switch } from "@/components/ui/switch";

import {
  getPrimarySelectedModelId,
  isSelectedModelCounts,
} from "@/lib/ai/types";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import { cn } from "@/lib/utils";
import { ModelSelectorLogo } from "./model-selector-logo";

const stopEventPropagation = (event: {
  readonly stopPropagation: () => void;
}): void => {
  event.stopPropagation();
};

type FeatureFilter = Record<string, boolean>;
type Features = ReturnType<typeof getEnabledFeatures>;

const getFeatureIcons = (
  model: Readonly<Pick<AppModelDefinition, "toolCall" | "input">>,
  enabled: Features
): React.ReactNode[] => {
  const icons: React.ReactNode[] = [];

  const featureIconMap = [
    {
      condition: model.toolCall,
      config: enabled.find(
        (feature: { readonly key: string }) => feature.key === "functionCalling"
      ),
      key: "functionCalling",
    },
    {
      condition: model.input?.image,
      config: enabled.find(
        (feature: { readonly key: string }) => feature.key === "imageInput"
      ),
      key: "imageInput",
    },
    {
      condition: model.input?.pdf,
      config: enabled.find(
        (feature: { readonly key: string }) => feature.key === "pdfInput"
      ),
      key: "pdfInput",
    },
  ];

  for (const { condition, config: featureConfig } of featureIconMap) {
    if (condition === true && featureConfig) {
      const IconComponent = featureConfig.icon;
      icons.push(
        <div
          className="flex items-center"
          key={featureConfig.key}
          title={featureConfig.description}
        >
          <IconComponent className="text-muted-foreground h-3 w-3" />
        </div>
      );
    }
  }

  return icons;
};

const buildMultiModelSelection = (
  modelIds: readonly AppModelId[]
): SelectedModelCounts => {
  const selection: Partial<Record<AppModelId, number>> = {};
  for (const modelId of modelIds) {
    selection[modelId] = 1;
  }
  return selection;
};

const getSelectionCount = (selection: SelectedModelValue): number => {
  if (typeof selection === "string") {
    return 1;
  }

  let count = 0;

  for (const value of Object.values(selection)) {
    count += value ?? 0;
  }

  return count;
};

const PureCommandItem = ({
  model,
  disabled,
  isSelected,
  count,
  showSelectionControl,
  onCountChange,
  enabledFeatures,
}: {
  readonly enabledFeatures: Features;
  readonly model: ReadonlyNativeSurface<AppModelDefinition>;
  readonly disabled?: boolean;
  readonly isSelected: boolean;
  readonly count?: number;
  readonly showSelectionControl: boolean;
  readonly onCountChange?: (id: AppModelId, delta: number) => void;
}): ReactJSX.Element => {
  const featureIcons = useMemo(
    () => getFeatureIcons(model, enabledFeatures),
    [model, enabledFeatures]
  );
  const reasoningConfig = useMemo(
    () =>
      enabledFeatures.find(
        (feature: { readonly key: string }) => feature.key === "reasoning"
      ),
    [enabledFeatures]
  );
  return (
    <div className="flex items-center gap-1">
      <Combobox.Item
        value={model.id}
        disabled={disabled}
        aria-label={model.reasoning ? `${model.name} (reasoning)` : model.name}
        className={cn(
          "data-highlighted:bg-muted flex h-9 min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 rounded-xl border-s-2 border-transparent px-2.5 py-1.5 text-sm",
          isSelected && "border-s-primary bg-primary/10",
          disabled === true && "cursor-not-allowed opacity-50"
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {showSelectionControl && (
            <ModelSelectionIndicator selected={isSelected} />
          )}
          <div className="shrink-0">
            <ModelSelectorLogo modelId={model.id} />
          </div>
          <span className="flex items-center gap-1.5 truncate text-sm font-medium">
            {model.name}
            {model.reasoning && reasoningConfig && (
              <span
                className="inline-flex shrink-0 items-center gap-1"
                title={reasoningConfig.description}
              >
                <reasoningConfig.icon className="text-muted-foreground h-3 w-3" />
              </span>
            )}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">{featureIcons}</div>
      </Combobox.Item>
      {isSelected && onCountChange && count !== undefined && (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`${count}× ${model.name}`}
            className="bg-primary/15 text-foreground hover:bg-primary/25 flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums"
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
                  onClick={(event: {
                    readonly stopPropagation: () => void;
                  }) => {
                    event.stopPropagation();
                    onCountChange(model.id, modelCount - count);
                  }}
                >
                  {modelCount}x
                  {modelCount === count && (
                    <CheckIcon className="ml-auto h-3 w-3" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};

const CommandItem = memo(PureCommandItem);

const MultipleModelsSetting = ({
  checked,
  onCheckedChange,
}: {
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
}): ReactJSX.Element => {
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

const PureModelSelector = ({
  allowMultiple = true,
  selectedModelId,
  selectedModelSelection,
  fallbackModelName,
  className,
  onModelSelectionChangeAction,
  chatModels,
  allModels,
  modelsDisabled,
  enabledFeatures,
  footer,
  disabledModelsNotice,
}: {
  readonly chatModels: readonly ReadonlyNativeSurface<AppModelDefinition>[];
  readonly allModels: readonly ReadonlyNativeSurface<AppModelDefinition>[];
  readonly modelsDisabled: boolean;
  readonly enabledFeatures: Features;
  readonly footer?: React.ReactNode;
  readonly disabledModelsNotice?: React.ReactNode;
  readonly allowMultiple?: boolean;
  readonly selectedModelId: AppModelId;
  readonly selectedModelSelection: SelectedModelValue;
  readonly fallbackModelName?: string;
  readonly onModelSelectionChangeAction?: (
    selection: SelectedModelValue
  ) => void | Promise<void>;
  readonly className?: string;
}): ReactJSX.Element => {
  const initialFilters = useMemo<FeatureFilter>(
    () =>
      Object.fromEntries(
        enabledFeatures.map((feature) => [feature.key, false])
      ),
    [enabledFeatures]
  );

  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [optimisticSelection, setOptimisticSelection] = useOptimistic(
    selectedModelSelection
  );
  const [featureFilters, setFeatureFilters] =
    useState<FeatureFilter>(initialFilters);
  const handleResetFilters = useCallback((): void => {
    setFeatureFilters(initialFilters);
  }, [initialFilters]);
  const [useMultipleModels, setUseMultipleModels] = useState(
    isSelectedModelCounts(selectedModelSelection)
  );

  interface ModelItem {
    readonly disabled: boolean;
    readonly model: ReadonlyNativeSurface<AppModelDefinition>;
  }

  const [previousSelection, setPreviousSelection] = useState(
    selectedModelSelection
  );
  if (previousSelection !== selectedModelSelection) {
    setPreviousSelection(selectedModelSelection);
    setUseMultipleModels(isSelectedModelCounts(selectedModelSelection));
  }

  const optimisticModelId = useMemo(
    () => getPrimarySelectedModelId(optimisticSelection) ?? selectedModelId,
    [optimisticSelection, selectedModelId]
  );

  const selectedModelIds = useMemo(() => {
    if (typeof optimisticSelection === "string") {
      return new Set<AppModelId>([optimisticSelection]);
    }

    return new Set<string>(
      Object.entries(optimisticSelection)
        .filter(
          ([, count]: readonly [string, number | undefined]) =>
            typeof count === "number" && count > 0
        )
        .map(([modelId]: readonly [string, number | undefined]) => modelId)
    );
  }, [optimisticSelection]);

  const pickerValue = useMemo(
    () => (useMultipleModels ? [...selectedModelIds] : optimisticModelId),
    [useMultipleModels, selectedModelIds, optimisticModelId]
  );

  const models = useMemo<ModelItem[]>(
    () =>
      chatModels.map(
        (chatModel: ReadonlyNativeSurface<AppModelDefinition>) => ({
          disabled: modelsDisabled,
          model: chatModel,
        })
      ),
    [modelsDisabled, chatModels]
  );

  const hasDisabledModels = useMemo(
    () =>
      models.some(
        (modelItem: Readonly<Pick<ModelItem, "disabled">>) => modelItem.disabled
      ),
    [models]
  );

  const filteredModels = useMemo(() => {
    const hasActiveFilters = Object.values(featureFilters).some(Boolean);
    if (!hasActiveFilters) {
      return models;
    }

    return models.filter(
      ({
        model,
      }: {
        readonly model: Readonly<
          Pick<
            AppModelDefinition,
            "reasoning" | "toolCall" | "input" | "output"
          >
        >;
      }) =>
        Object.entries(featureFilters).every(
          ([key, isActive]: readonly [string, boolean]) => {
            if (!isActive) {
              return true;
            }
            switch (key) {
              case "reasoning": {
                return model.reasoning;
              }
              case "functionCalling": {
                return model.toolCall === true;
              }
              case "imageInput": {
                return model.input?.image;
              }
              case "pdfInput": {
                return model.input?.pdf;
              }
              case "audioInput": {
                return model.input?.audio;
              }
              case "imageOutput": {
                return model.output?.image;
              }
              case "audioOutput": {
                return model.output?.audio;
              }
              default: {
                return true;
              }
            }
          }
        )
    );
  }, [models, featureFilters]);

  const matches = useMemo(() => {
    if (!search.trim()) {
      return filteredModels;
    }
    return filteredModels
      .map((item) => {
        const { model } = item;
        const label = `${model.name} ${model.reasoning ? "reasoning" : ""} ${model.owned_by}`;
        return { item, score: defaultFilter(label, search) };
      })
      .filter(({ score }) => score > 0)
      .toSorted((a, b) => b.score - a.score)
      .map(({ item }) => item);
  }, [filteredModels, search]);

  const selectedItem = useMemo<ModelItem | null>(() => {
    // First try to find in filtered models (user's enabled models)
    const found = models.find(
      (modelItem: { readonly model: { readonly id: string } }) =>
        modelItem.model.id === optimisticModelId
    );
    if (found) {
      return found;
    }

    // Fallback: look in all models to at least display the model name
    // This handles cases where preferences are loading or model was disabled
    const fallbackModel = allModels.find(
      (model: Readonly<Pick<AppModelDefinition, "id">>) =>
        model.id === optimisticModelId
    );
    if (fallbackModel) {
      return {
        disabled: modelsDisabled,
        model: fallbackModel,
      } satisfies ModelItem;
    }

    return null;
  }, [models, allModels, optimisticModelId, modelsDisabled]);
  const reasoningConfig = useMemo(
    () =>
      enabledFeatures.find(
        (feature: { readonly key: string }) => feature.key === "reasoning"
      ),
    [enabledFeatures]
  );
  const activeFilterCount = useMemo(
    () => Object.values(featureFilters).filter(Boolean).length,
    [featureFilters]
  );
  const selectedModelCount = useMemo(
    () => getSelectionCount(optimisticSelection),
    [optimisticSelection]
  );
  const modelName = nonEmptyText(selectedItem?.model.name) ?? fallbackModelName;
  const triggerLabel =
    useMultipleModels && selectedModelCount > 1
      ? `${modelName ?? "Selected model"} +${selectedModelCount - 1}`
      : (modelName ?? "Select model");

  const dispatchSelection = useCallback(
    (selection: SelectedModelValue): void => {
      try {
        // Run the producer before the transition so Send sees its local selection immediately.
        const completion = onModelSelectionChangeAction?.(selection);
        startTransition(async () => {
          setOptimisticSelection(selection);
          await completion;
        });
      } catch (error) {
        startTransition(() => {
          throw error;
        });
      }
    },
    [onModelSelectionChangeAction, setOptimisticSelection, startTransition]
  );

  const changeModels = (value: string | string[] | null): void => {
    if (typeof value === "string") {
      dispatchSelection(value);
      setOpen(false);
    } else if (value && value.length > 0) {
      const counts =
        typeof optimisticSelection === "string" ? {} : optimisticSelection;
      dispatchSelection(
        Object.fromEntries(value.map((id) => [id, counts[id] ?? 1]))
      );
    }
  };

  const handleCountChange = useCallback(
    (id: AppModelId, delta: number) => {
      const current = optimisticSelection;
      const currentCounts: SelectedModelCounts =
        typeof current === "string" ? { [current]: 1 } : current;

      const newCount = (currentCounts[id] ?? 0) + delta;
      let nextSelection: SelectedModelValue;

      if (newCount <= 0) {
        const remaining = Object.entries(currentCounts).filter(
          ([candidateId, selectionCount]: readonly [
            string,
            number | undefined,
          ]) =>
            candidateId !== id &&
            typeof selectionCount === "number" &&
            selectionCount > 0
        );
        if (remaining.length === 0) {
          return;
        }
        nextSelection = Object.fromEntries(remaining);
      } else {
        nextSelection = { ...currentCounts, [id]: newCount };
      }

      dispatchSelection(nextSelection);
    },
    [dispatchSelection, optimisticSelection]
  );

  const handleMultipleModelsToggle = useCallback(
    (checked: boolean) => {
      setUseMultipleModels(checked);

      if (checked) {
        dispatchSelection(buildMultiModelSelection([optimisticModelId]));
        return;
      }

      dispatchSelection(optimisticModelId);
    },
    [dispatchSelection, optimisticModelId]
  );

  return (
    <Popover
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setSearch("");
        }
      }}
      open={open}
    >
      <PopoverButton
        aria-expanded={open}
        className={cn("flex w-fit justify-between gap-2 md:px-2", className)}
        data-testid="model-selector"
        variant="ghost"
      >
        <div className="flex items-center gap-2">
          {selectedItem && (
            <div className="shrink-0">
              <ModelSelectorLogo modelId={selectedItem.model.id} />
            </div>
          )}
          <p className="inline-flex items-center gap-1.5 truncate">
            {triggerLabel}
            {selectedItem?.model.reasoning === true && reasoningConfig && (
              <span
                className="inline-flex shrink-0 items-center gap-1"
                title={reasoningConfig.description}
              >
                <reasoningConfig.icon className="text-muted-foreground h-3 w-3" />
              </span>
            )}
          </p>
        </div>
        <ChevronUpIcon
          className={cn(
            "h-4 w-4 shrink-0 opacity-50 transition-transform",
            open && "rotate-180"
          )}
        />
      </PopoverButton>
      <PopoverContent
        align="start"
        className="w-[350px] max-w-[calc(100vw-1rem)] p-0"
      >
        {open && (
          <Combobox.Root<string, boolean>
            inline
            open
            autoHighlight
            multiple={useMultipleModels}
            filteredItems={matches.map(({ model }) => model.id)}
            value={pickerValue}
            onValueChange={changeModels}
            inputValue={search}
            onInputValueChange={(value, details) => {
              if (
                details.reason === "input-change" ||
                details.reason === "input-clear"
              ) {
                setSearch(value);
              }
            }}
          >
            <div className="flex items-center gap-1 border-b p-2">
              <InputGroup className="h-8! min-w-0 flex-1">
                <Combobox.Input
                  aria-label="Search models"
                  placeholder="Search models..."
                  className="w-full min-w-0 text-sm outline-hidden"
                />
                <InputGroupAddon>
                  <SearchIcon className="size-4 opacity-50" />
                </InputGroupAddon>
              </InputGroup>
              <Popover onOpenChange={setFilterOpen} open={filterOpen}>
                <PopoverButton
                  aria-label="Filter models"
                  className={cn(
                    "relative mr-3 h-8 w-8 p-0",
                    activeFilterCount > 0 && "text-primary"
                  )}
                  size="sm"
                  variant="ghost"
                >
                  <FilterIcon className="h-4 w-4" />
                  {activeFilterCount > 0 && (
                    <Badge
                      className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center p-0 text-xs"
                      variant="secondary"
                    >
                      {activeFilterCount}
                    </Badge>
                  )}
                </PopoverButton>
                <PopoverContent align="end" className="p-0">
                  <div className="p-4">
                    <div className="mb-3 flex h-7 items-center justify-between">
                      <div className="text-sm font-medium">Filter by Tools</div>
                      {activeFilterCount > 0 && (
                        <Button
                          className="h-6 text-xs"
                          onClick={handleResetFilters}
                          size="sm"
                          variant="ghost"
                        >
                          Clear filters
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {enabledFeatures.map(
                        (
                          feature: Readonly<
                            Pick<
                              (typeof enabledFeatures)[number],
                              "key" | "name"
                            >
                          > & {
                            readonly icon: React.JSXElementConstructor<
                              Pick<
                                React.ComponentProps<
                                  (typeof enabledFeatures)[number]["icon"]
                                >,
                                "className"
                              >
                            >;
                          }
                        ) => {
                          const IconComponent = feature.icon;
                          return (
                            <div
                              className="flex items-center space-x-2"
                              key={feature.key}
                            >
                              <Checkbox
                                checked={featureFilters[feature.key]}
                                id={feature.key}
                                onCheckedChange={(
                                  checked: boolean | "indeterminate"
                                ) => {
                                  setFeatureFilters(
                                    (prev: Readonly<FeatureFilter>) => ({
                                      ...prev,
                                      [feature.key]: checked === true,
                                    })
                                  );
                                }}
                              />
                              <Label
                                className="flex items-center gap-1.5 text-sm"
                                htmlFor={feature.key}
                              >
                                <IconComponent className="h-3.5 w-3.5" />
                                {feature.name}
                              </Label>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            {allowMultiple && (
              <MultipleModelsSetting
                checked={useMultipleModels}
                onCheckedChange={handleMultipleModelsToggle}
              />
            )}
            {hasDisabledModels && (
              <div className="p-3">{disabledModelsNotice}</div>
            )}
            <Combobox.Empty className="text-center text-sm not-empty:py-6">
              No model found.
            </Combobox.Empty>
            <Combobox.List
              aria-label="Models"
              className="max-h-[min(40dvh,400px)] overflow-y-auto p-2 empty:p-0"
              onMouseDown={stopEventPropagation}
            >
              {matches.map(({ model, disabled }: Readonly<ModelItem>) => {
                const isSelected = useMultipleModels
                  ? selectedModelIds.has(model.id)
                  : model.id === optimisticModelId;
                const count =
                  useMultipleModels && typeof optimisticSelection !== "string"
                    ? (optimisticSelection[model.id] ?? 0)
                    : undefined;
                return (
                  <CommandItem
                    count={isSelected ? count : undefined}
                    disabled={disabled}
                    isSelected={isSelected}
                    key={model.id}
                    model={model}
                    enabledFeatures={enabledFeatures}
                    onCountChange={
                      useMultipleModels ? handleCountChange : undefined
                    }
                    showSelectionControl={useMultipleModels}
                  />
                );
              })}
            </Combobox.List>
            {footer}
          </Combobox.Root>
        )}
      </PopoverContent>
    </Popover>
  );
};

export const ModelSelectorView = memo(PureModelSelector);
