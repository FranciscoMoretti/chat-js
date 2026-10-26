"use client";

import { settingsItems } from "@/settings-items";
import type { AppModelDefinition, AppModelId } from "@/lib/ai/app-models";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  FilterIcon,
} from "lucide-react";
import React, {
  memo,
  useCallback,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
} from "react";

import { InternalLink } from "@/components/internal-link";

import { Badge } from "@/components/ui/badge";

import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
  CommandItem as UICommandItem,
} from "@/components/ui/command";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import type { SelectedModelCounts, SelectedModelValue } from "@/lib/ai/types";

import type { JSX as ReactJSX } from "react";

import { Switch } from "@/components/ui/switch";

import { LoginCtaBanner } from "@/components/upgrade-cta/login-cta-banner";
import {
  getPrimarySelectedModelId,
  isSelectedModelCounts,
} from "@/lib/ai/types";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { config } from "@/lib/config";

import { getEnabledFeatures } from "@/lib/features-config";

import { ANONYMOUS_LIMITS } from "@/lib/types/anonymous";

import { cn } from "@/lib/utils";
import { useChatModels } from "@/providers/chat-models-provider";
import { ModelSelectorLogo } from "./model-selector-logo";

import { useSession } from "@/providers/session-provider";

const stopEventPropagation = (event: {
  readonly stopPropagation: () => void;
}): void => {
  event.stopPropagation();
};

type FeatureFilter = Record<string, boolean>;

const enabledFeatures = getEnabledFeatures();
const initialFilters: FeatureFilter = {};
for (const feature of enabledFeatures) {
  initialFilters[feature.key] = false;
}

const getFeatureIcons = (
  model: Readonly<Pick<AppModelDefinition, "toolCall" | "input">>
): React.ReactNode[] => {
  const icons: React.ReactNode[] = [];
  const enabled = getEnabledFeatures();

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
  onSelect,
  onCountChange,
}: {
  readonly model: ReadonlyNativeSurface<AppModelDefinition>;
  readonly disabled?: boolean;
  readonly isSelected: boolean;
  readonly count?: number;
  readonly showSelectionControl: boolean;
  readonly onSelect: (id: AppModelId) => void;
  readonly onCountChange?: (id: AppModelId, delta: number) => void;
}): ReactJSX.Element => {
  const featureIcons = useMemo(() => getFeatureIcons(model), [model]);
  const searchValue = useMemo(
    () =>
      `${model.name} ${model.reasoning ? "reasoning" : ""} ${model.owned_by} `.toLowerCase(),
    [model]
  );

  const reasoningConfig = useMemo(
    () =>
      getEnabledFeatures().find(
        (feature: { readonly key: string }) => feature.key === "reasoning"
      ),
    []
  );
  const handleSelect = useCallback((): void => {
    if (disabled !== true) {
      onSelect(model.id);
    }
  }, [disabled, model, onSelect]);

  return (
    <UICommandItem
      aria-label={model.reasoning ? `${model.name} (reasoning)` : model.name}
      className={cn(
        "flex h-9 w-full cursor-pointer items-center justify-between px-3 py-1.5 transition-all",
        isSelected && "border-l-primary bg-primary/10 border-l-2",
        disabled === true && "cursor-not-allowed opacity-50"
      )}
      onSelect={handleSelect}
      value={searchValue}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {showSelectionControl && (
          <Checkbox
            aria-hidden
            tabIndex={-1}
            readOnly
            checked={isSelected}
            className="pointer-events-none"
          />
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
      <div className="flex shrink-0 items-center gap-1">
        {featureIcons}
        {isSelected && onCountChange && count !== undefined && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  aria-label={`${count}×`}
                  className="bg-primary/15 text-foreground hover:bg-primary/25 flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums"
                  type="button"
                />
              }
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
    </UICommandItem>
  );
};

const CommandItem = memo(PureCommandItem);

const ModelSettingsLink = (): ReactJSX.Element | null => {
  const item = settingsItems.find((entry) => entry.id === "models");
  if (!item || !(item.isVisible?.() ?? true)) {
    return null;
  }
  return (
    <div className="border-t p-2">
      <InternalLink
        aria-label="Add Models"
        href={item.href}
        className={buttonVariants({
          className: "w-full justify-between",
          size: "sm",
          variant: "ghost",
        })}
      >
        Add Models
        <ChevronRightIcon className="h-4 w-4" />
      </InternalLink>
    </div>
  );
};

const PureModelSelector = ({
  allowMultiple = true,
  selectedModelId,
  selectedModelSelection,
  className,
  onModelSelectionChangeAction,
}: {
  readonly allowMultiple?: boolean;
  readonly selectedModelId: AppModelId;
  readonly selectedModelSelection: SelectedModelValue;
  readonly onModelSelectionChangeAction?: (
    selection: SelectedModelValue
  ) => void | Promise<void>;
  readonly className?: string;
}): ReactJSX.Element => {
  const { data: session } = useSession();
  const isAnonymous = !session?.user;
  const { models: chatModels, allModels } = useChatModels();

  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [optimisticSelection, setOptimisticSelection] = useOptimistic(
    selectedModelSelection
  );
  const [featureFilters, setFeatureFilters] =
    useState<FeatureFilter>(initialFilters);
  const handleResetFilters = useCallback((): void => {
    setFeatureFilters(initialFilters);
  }, [setFeatureFilters]);
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

  const models = useMemo<ModelItem[]>(
    () =>
      chatModels.map(
        (chatModel: ReadonlyNativeSurface<AppModelDefinition>) => ({
          disabled:
            isAnonymous &&
            !ANONYMOUS_LIMITS.AVAILABLE_MODELS.includes(chatModel.id),
          model: chatModel,
        })
      ),
    [isAnonymous, chatModels]
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
        disabled:
          isAnonymous &&
          !ANONYMOUS_LIMITS.AVAILABLE_MODELS.includes(fallbackModel.id),
        model: fallbackModel,
      } satisfies ModelItem;
    }

    return null;
  }, [models, allModels, optimisticModelId, isAnonymous]);
  const reasoningConfig = useMemo(
    () =>
      getEnabledFeatures().find(
        (feature: { readonly key: string }) => feature.key === "reasoning"
      ),
    []
  );
  const activeFilterCount = useMemo(
    () => Object.values(featureFilters).filter(Boolean).length,
    [featureFilters]
  );
  const selectedModelCount = useMemo(
    () => getSelectionCount(optimisticSelection),
    [optimisticSelection]
  );
  const triggerLabel = useMemo(() => {
    if (useMultipleModels && selectedModelCount > 1) {
      const modelName = selectedItem?.model.name;
      if (modelName !== undefined && modelName !== "") {
        return `${modelName} +${selectedModelCount - 1}`;
      }
      return `Selected model +${selectedModelCount - 1}`;
    }

    const modelName = selectedItem?.model.name;
    if (modelName !== undefined && modelName !== "") {
      return modelName;
    }
    return "Select model";
  }, [selectedItem?.model.name, selectedModelCount, useMultipleModels]);

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

  const selectSingleModel = useCallback(
    (id: AppModelId) => {
      dispatchSelection(id);
      setOpen(false);
    },
    [dispatchSelection, setOpen]
  );

  const toggleMultiModel = useCallback(
    (id: AppModelId) => {
      const current = optimisticSelection;
      const currentCounts: SelectedModelCounts =
        typeof current === "string" ? { [current]: 1 } : current;

      const isAlreadySelected = (currentCounts[id] ?? 0) > 0;

      let nextSelection: SelectedModelCounts;
      if (isAlreadySelected) {
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
        nextSelection = { ...currentCounts, [id]: 1 };
      }

      dispatchSelection(nextSelection);
    },
    [dispatchSelection, optimisticSelection]
  );

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
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        render={
          <Button
            aria-expanded={open}
            className={cn(
              "flex w-fit justify-between gap-2 md:px-2",
              className
            )}
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
          </Button>
        }
      />
      <PopoverContent align="start" className="w-[350px] p-0">
        {open && (
          <Command>
            <div className="flex items-center border-b">
              <CommandInput
                className="px-3"
                onClick={stopEventPropagation}
                aria-label="Search models"
                placeholder="Search models..."
              />
              <Popover onOpenChange={setFilterOpen} open={filterOpen}>
                <PopoverTrigger
                  render={
                    <Button
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
                    </Button>
                  }
                />
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
            {allowMultiple &&
              !isAnonymous &&
              config.features.parallelResponses && (
                <div className="flex items-center justify-between border-b px-3 py-2">
                  <Label
                    className="cursor-pointer text-sm"
                    htmlFor="use-multiple-models"
                  >
                    Use Multiple Models
                  </Label>
                  <Switch
                    checked={useMultipleModels}
                    id="use-multiple-models"
                    onCheckedChange={handleMultipleModelsToggle}
                  />
                </div>
              )}
            {hasDisabledModels && (
              <div className="p-3">
                <LoginCtaBanner
                  compact
                  message="Sign in to unlock all models."
                  variant="default"
                />
              </div>
            )}
            <CommandList
              className="max-h-[min(40dvh,400px)]"
              onMouseDown={stopEventPropagation}
            >
              <CommandEmpty>No model found.</CommandEmpty>
              <CommandGroup>
                {filteredModels.map(
                  ({ model, disabled }: Readonly<ModelItem>) => {
                    const isSelected = useMultipleModels
                      ? selectedModelIds.has(model.id)
                      : model.id === optimisticModelId;
                    const count =
                      useMultipleModels &&
                      typeof optimisticSelection !== "string"
                        ? (optimisticSelection[model.id] ?? 0)
                        : undefined;
                    return (
                      <CommandItem
                        count={isSelected ? count : undefined}
                        disabled={disabled}
                        isSelected={isSelected}
                        key={model.id}
                        model={model}
                        onCountChange={
                          useMultipleModels ? handleCountChange : undefined
                        }
                        onSelect={
                          useMultipleModels
                            ? toggleMultiModel
                            : selectSingleModel
                        }
                        showSelectionControl={useMultipleModels}
                      />
                    );
                  }
                )}
              </CommandGroup>
            </CommandList>
            {!isAnonymous && <ModelSettingsLink />}
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
};

export const ModelSelector = memo(
  PureModelSelector,
  (prev, next) =>
    prev.allowMultiple === next.allowMultiple &&
    prev.selectedModelId === next.selectedModelId &&
    prev.selectedModelSelection === next.selectedModelSelection &&
    prev.className === next.className &&
    prev.onModelSelectionChangeAction === next.onModelSelectionChangeAction
);
