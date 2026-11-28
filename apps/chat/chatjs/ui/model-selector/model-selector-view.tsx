"use client";

import type { getEnabledFeatures } from "@/lib/features-config";

import { Checkbox } from "@/components/ui/checkbox";
import { PopoverButton } from "@/components/popover-button";
import { nonEmptyText } from "@/components/text-value";
import type { AppModelDefinition, AppModelId } from "@/lib/ai/app-models";
import { CheckIcon, ChevronUpIcon, FilterIcon, SearchIcon } from "lucide-react";
import React, { memo, useCallback, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";

import { Combobox } from "@base-ui/react/combobox";
import { defaultFilter } from "cmdk";
import { InputGroup, InputGroupAddon } from "@/components/ui/input-group";

import { Label } from "@/components/ui/label";

import { Popover, PopoverContent } from "@/components/ui/popover";

import type { JSX as ReactJSX } from "react";

import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import { cn } from "@/lib/utils";
import { ModelLogo } from "@/chatjs/ui/model-logo";

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

const PureCommandItem = ({
  model,
  disabled,
  isSelected,
  prefix,
  action,
  reserveAction,
  enabledFeatures,
}: {
  readonly enabledFeatures: Features;
  readonly model: ReadonlyNativeSurface<AppModelDefinition>;
  readonly disabled?: boolean;
  readonly isSelected: boolean;
  readonly prefix?: React.ReactNode;
  readonly action?: React.ReactNode;
  readonly reserveAction?: boolean;
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
    <div
      className={cn(
        "has-data-highlighted:bg-muted flex items-center rounded-lg",
        isSelected && "bg-primary/10"
      )}
    >
      <Combobox.Item
        value={model.id}
        disabled={disabled}
        aria-label={model.reasoning ? `${model.name} (reasoning)` : model.name}
        className={cn(
          "flex h-9 min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm",
          reserveAction === true &&
            (action === null || action === undefined) &&
            "pe-14",
          disabled === true && "cursor-not-allowed opacity-50"
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {prefix}
          <div className="shrink-0">
            <ModelLogo modelId={model.id} />
          </div>
          <span className="flex min-w-0 items-center gap-1.5 font-medium">
            <span className="truncate">{model.name}</span>
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
          {(prefix === null || prefix === undefined) && (
            <span className="ms-1 grid size-4 place-items-center" aria-hidden>
              {isSelected && <CheckIcon className="size-3.5" />}
            </span>
          )}
        </div>
      </Combobox.Item>
      {action}
    </div>
  );
};

const CommandItem = memo(PureCommandItem);

const PureModelSelector = ({
  options,
  selectedModelId,

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
  readonly options?: {
    readonly header: React.ReactNode;
    readonly values?: readonly string[];
    readonly suffix?: string;
    readonly onChange: (ids: string[]) => void;
    readonly renderPrefix?: (selected: boolean) => React.ReactNode;
    readonly renderAction?: (
      model: ReadonlyNativeSurface<AppModelDefinition>
    ) => React.ReactNode;
  };
  readonly selectedModelId: AppModelId;
  readonly fallbackModelName?: string;
  readonly onModelSelectionChangeAction?: (
    selection: string
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

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [featureFilters, setFeatureFilters] =
    useState<FeatureFilter>(initialFilters);
  const handleResetFilters = useCallback((): void => {
    setFeatureFilters(initialFilters);
  }, [initialFilters]);
  interface ModelItem {
    readonly disabled: boolean;
    readonly model: ReadonlyNativeSurface<AppModelDefinition>;
  }

  const pickerValue = options?.values ? [...options.values] : selectedModelId;

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
        modelItem.model.id === selectedModelId
    );
    if (found) {
      return found;
    }

    // Fallback: look in all models to at least display the model name
    // This handles cases where preferences are loading or model was disabled
    const fallbackModel = allModels.find(
      (model: Readonly<Pick<AppModelDefinition, "id">>) =>
        model.id === selectedModelId
    );
    if (fallbackModel) {
      return {
        disabled: modelsDisabled,
        model: fallbackModel,
      } satisfies ModelItem;
    }

    return null;
  }, [models, allModels, selectedModelId, modelsDisabled]);
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
  const modelName = nonEmptyText(selectedItem?.model.name) ?? fallbackModelName;
  const triggerLabel = (modelName ?? "Select model") + (options?.suffix ?? "");
  const changeModels = (value: string | string[] | null) => {
    if (typeof value === "string") {
      void onModelSelectionChangeAction?.(value);
      setOpen(false);
    } else if (value && value.length > 0) {
      options?.onChange(value);
    }
  };

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
              <ModelLogo modelId={selectedItem.model.id} />
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
        className="w-[350px] max-w-[calc(100vw-1rem)] gap-0 p-0"
      >
        {open && (
          <Combobox.Root<string, boolean>
            inline
            open
            autoHighlight
            multiple={options?.values !== undefined}
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
                    "relative h-8 w-8 p-0",
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
            {options?.header}
            {hasDisabledModels && (
              <div className="p-3 empty:hidden">{disabledModelsNotice}</div>
            )}
            <Combobox.Empty className="text-center text-sm not-empty:py-6">
              No model found.
            </Combobox.Empty>
            <Combobox.List
              aria-label="Models"
              className="max-h-[min(40dvh,400px)] overflow-y-auto p-1 empty:p-0"
              onMouseDown={stopEventPropagation}
            >
              {matches.map(({ model, disabled }: Readonly<ModelItem>) => {
                const isSelected =
                  options?.values?.includes(model.id) ??
                  model.id === selectedModelId;
                return (
                  <CommandItem
                    prefix={options?.renderPrefix?.(isSelected)}
                    action={options?.renderAction?.(model)}
                    reserveAction={options?.renderAction !== undefined}
                    disabled={disabled}
                    isSelected={isSelected}
                    key={model.id}
                    model={model}
                    enabledFeatures={enabledFeatures}
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
