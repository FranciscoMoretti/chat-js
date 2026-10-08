"use client";

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
import type { JSX as ReactJSX } from "react";

// oxlint-disable-next-line sort-imports -- Oxfmt groups this type reader import by module; sort-imports requires a different binding-name or syntax order.
import { InternalLink } from "@/components/internal-link";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Badge } from "@/components/ui/badge";
/* oxlint-enable sort-imports */
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
  CommandItem as UICommandItem,
} from "@/components/ui/command";
/* oxlint-enable sort-imports */
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
/* oxlint-enable sort-imports */
/* oxlint-disable import/max-dependencies -- @/components/ui/switch import: import/max-dependencies: these direct dependencies compose this feature without hiding imports behind a barrel. */
import { Switch } from "@/components/ui/switch";
/* oxlint-enable import/max-dependencies */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { LoginCtaBanner } from "@/components/upgrade-cta/login-cta-banner";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { AppModelDefinition, AppModelId } from "@/lib/ai/app-models";
/* oxlint-enable sort-imports */
import type { SelectedModelCounts, SelectedModelValue } from "@/lib/ai/types";
import {
  getPrimarySelectedModelId,
  isSelectedModelCounts,
} from "@/lib/ai/types";
import { config } from "@/lib/config";
import { getEnabledFeatures } from "@/lib/features-config";
// oxlint-disable-next-line sort-imports -- Oxfmt groups this type reader import by module; sort-imports requires a different binding-name or syntax order.
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { ANONYMOUS_LIMITS } from "@/lib/types/anonymous";
/* oxlint-enable sort-imports */
import { cn } from "@/lib/utils";
import { useChatModels } from "@/providers/chat-models-provider";
import { useSession } from "@/providers/session-provider";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { ModelSelectorLogo } from "./model-selector-logo";
/* oxlint-enable sort-imports */

type FeatureFilter = Record<string, boolean>;

const enabledFeatures = getEnabledFeatures();
const initialFilters: FeatureFilter = {};
for (const feature of enabledFeatures) {
  initialFilters[feature.key] = false;
}
/* oxlint-disable typescript/explicit-function-return-type, typescript/strict-boolean-expressions -- getFeatureIcons: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including condition). */

const getFeatureIcons = (
  model: Readonly<Pick<AppModelDefinition, "toolCall" | "input">>
) => {
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
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading image from model.input; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      condition: model.input?.image,
      config: enabled.find(
        (feature: { readonly key: string }) => feature.key === "imageInput"
      ),
      key: "imageInput",
    },
    {
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading pdf from model.input; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      condition: model.input?.pdf,
      config: enabled.find(
        (feature: { readonly key: string }) => feature.key === "pdfInput"
      ),
      key: "pdfInput",
    },
  ];

  for (const { condition, config: featureConfig } of featureIconMap) {
    if (condition && featureConfig) {
      const IconComponent = featureConfig.icon;
      icons.push(
        <div
          className="flex items-center"
          key={featureConfig.key}
          title={featureConfig.description}
        >
          <IconComponent
            // oxlint-disable-next-line react/forbid-component-props -- IconComponent accepts className in its styling contract; preserve this caller's layout and appearance.
            className="text-muted-foreground h-3 w-3"
          />
        </div>
      );
    }
  }

  return icons;
};
/* oxlint-enable typescript/explicit-function-return-type, typescript/strict-boolean-expressions */

const buildMultiModelSelection = (
  modelIds: readonly AppModelId[]
): SelectedModelCounts => {
  const selection: Partial<Record<AppModelId, number>> = {};
  for (const modelId of modelIds) {
    selection[modelId] = 1;
  }
  return selection;
};

/* oxlint-disable no-magic-numbers -- getSelectionCount: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 1). */

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
/* oxlint-disable react/jsx-no-literals -- PureCommandItem renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable max-lines-per-function, no-magic-numbers, no-undefined, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/strict-boolean-expressions -- PureCommandItem: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 1); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including disabled). */

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
      // oxlint-disable-next-line no-ternary -- Keep template interpolation as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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

  return (
    <UICommandItem
      // oxlint-disable-next-line react/forbid-component-props -- UICommandItem accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn(
        "flex h-9 w-full cursor-pointer items-center justify-between px-3 py-1.5 transition-all",
        isSelected && "border-l-primary bg-primary/10 border-l-2",
        disabled && "cursor-not-allowed opacity-50"
      )}
      onSelect={() => {
        void (!disabled && onSelect(model.id));
      }}
      value={searchValue}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {showSelectionControl && (
          <Checkbox
            checked={isSelected}
            // oxlint-disable-next-line react/forbid-component-props -- Checkbox accepts className in its styling contract; preserve this caller's layout and appearance.
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
              asChild
              onClick={(event: { readonly stopPropagation: () => void }) =>
                event.stopPropagation()
              }
              onMouseDown={(event: { readonly stopPropagation: () => void }) =>
                event.stopPropagation()
              }
            >
              <button
                className="bg-primary/15 text-foreground hover:bg-primary/25 flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums"
                type="button"
              >
                {count}×
                <ChevronDownIcon
                  // oxlint-disable-next-line react/forbid-component-props -- ChevronDownIcon accepts className in its styling contract; preserve this caller's layout and appearance.
                  className="h-2.5 w-2.5"
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onKeyDown={(event: { readonly stopPropagation: () => void }) =>
                event.stopPropagation()
              }
            >
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
                    <CheckIcon
                      // oxlint-disable-next-line react/forbid-component-props -- CheckIcon accepts className in its styling contract; preserve this caller's layout and appearance.
                      className="ml-auto h-3 w-3"
                    />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </UICommandItem>
  );
};
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable max-lines-per-function, no-magic-numbers, no-undefined, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/strict-boolean-expressions */

const CommandItem = memo(PureCommandItem);
/* oxlint-disable react/jsx-no-literals -- PureModelSelector renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-disable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, no-undefined, react-perf/jsx-no-jsx-as-prop, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/no-multi-comp, typescript/strict-boolean-expressions, unicorn/no-null -- PureModelSelector: init-declarations: branches initialize this value before use; an eager undefined initializer adds a second missing-value state; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react-perf/jsx-no-jsx-as-prop: this component composition slot accepts an element from the current render; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including selectedItem?.model.name); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

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
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading user from session; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
            !(
              ANONYMOUS_LIMITS.AVAILABLE_MODELS as readonly AppModelId[]
            ).includes(chatModel.id),
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
                return model.toolCall;
              }
              case "imageInput": {
                // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading image from model.input; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
                return model.input?.image;
              }
              case "pdfInput": {
                // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading pdf from model.input; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
                return model.input?.pdf;
              }
              case "audioInput": {
                // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading audio from model.input; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
                return model.input?.audio;
              }
              case "imageOutput": {
                // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading image from model.output; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
                return model.output?.image;
              }
              case "audioOutput": {
                // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading audio from model.output; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
          !(
            ANONYMOUS_LIMITS.AVAILABLE_MODELS as readonly AppModelId[]
          ).includes(fallbackModel.id),
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
      // oxlint-disable-next-line typescript/prefer-nullish-coalescing, oxc/no-optional-chaining -- #602: Empty text or a falsy optional value deliberately selects the fallback; nullish coalescing would preserve that empty value. Optional chain: Keep the existing nullish guard when reading model from selectedItem; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      return `${selectedItem?.model.name || "Selected model"} +${selectedModelCount - 1}`;
    }

    // oxlint-disable-next-line typescript/prefer-nullish-coalescing, oxc/no-optional-chaining -- #602: Empty text or a falsy optional value deliberately selects the fallback; nullish coalescing would preserve that empty value. Optional chain: Keep the existing nullish guard when reading model from selectedItem; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    return selectedItem?.model.name || "Select model";
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading model from selectedItem; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  }, [selectedItem?.model.name, selectedModelCount, useMultipleModels]);

  const dispatchSelection = useCallback(
    (selection: SelectedModelValue): void => {
      try {
        // Run the producer before the transition so Send sees its local selection immediately.
        // oxlint-disable-next-line oxc/no-optional-chaining -- Preserve the optional Action's skipped call and original completion value.
        const completion = onModelSelectionChangeAction?.(selection);
        // oxlint-disable-next-line typescript/promise-function-async -- React receives the original Action promise without changing its identity or synchronous producer contract.
        startTransition(() => {
          setOptimisticSelection(selection);
          return completion;
        });
      } catch (error) {
        startTransition(() => {
          // oxlint-disable-next-line react/todo -- Preserve React's boundary ownership for a synchronously throwing selection producer.
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
    [dispatchSelection]
  );

  const toggleMultiModel = useCallback(
    (id: AppModelId) => {
      const current = optimisticSelection;
      const currentCounts: SelectedModelCounts =
        // oxlint-disable-next-line no-ternary -- Keep currentCounts as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing currentCounts own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
        // oxlint-disable-next-line no-ternary -- Keep currentCounts as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing currentCounts own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
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
              {
                /* oxlint-disable oxc/no-optional-chaining -- Keep the existing nullish guard when reading model from selectedItem; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining. */
                selectedItem?.model.reasoning &&
                  /* oxlint-enable oxc/no-optional-chaining */ reasoningConfig && (
                    <span
                      className="inline-flex shrink-0 items-center gap-1"
                      title={reasoningConfig.description}
                    >
                      <reasoningConfig.icon className="text-muted-foreground h-3 w-3" />
                    </span>
                  )
              }
            </p>
          </div>
          <ChevronUpIcon
            // oxlint-disable-next-line react/forbid-component-props -- ChevronUpIcon accepts className in its styling contract; preserve this caller's layout and appearance.
            className={cn(
              "h-4 w-4 shrink-0 opacity-50 transition-transform",
              open && "rotate-180"
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        // oxlint-disable-next-line react/forbid-component-props -- PopoverContent accepts className in its styling contract; preserve this caller's layout and appearance.
        className="w-[350px] p-0"
        onFocusOutside={(event: { readonly preventDefault: () => void }) =>
          event.preventDefault()
        }

        onInteractOutside={(event: {
          readonly target: unknown;
          readonly preventDefault: () => void;
        }) => {
          // Radix dispatches the outside event on its original target. Elements, including SVGs, expose closest(); other EventTargets do not.
          // Keep nested portal interactions from closing the model picker.
          if (
            event.target instanceof Element &&
            event.target.closest("[data-radix-popper-content-wrapper]")
          ) {
            event.preventDefault();
          }
        }}
      >
        {open && (
          <Command>
            <div className="flex items-center border-b">
              <CommandInput
                // oxlint-disable-next-line react/forbid-component-props -- CommandInput accepts className in its styling contract; preserve this caller's layout and appearance.
                className="px-3"
                containerClassName="w-full border-0 h-11"
                onClick={(event: { readonly stopPropagation: () => void }) =>
                  event.stopPropagation()
                }
                placeholder="Search models..."
              />
              <Popover onOpenChange={setFilterOpen} open={filterOpen}>
                <PopoverTrigger asChild>
                  <Button
                    // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
                    className={cn(
                      "relative mr-3 h-8 w-8 p-0",
                      activeFilterCount > 0 && "text-primary"
                    )}
                    size="sm"
                    variant="ghost"
                  >
                    <FilterIcon
                      // oxlint-disable-next-line react/forbid-component-props -- FilterIcon accepts className in its styling contract; preserve this caller's layout and appearance.
                      className="h-4 w-4"
                    />
                    {activeFilterCount > 0 && (
                      <Badge
                        // oxlint-disable-next-line react/forbid-component-props -- Badge accepts className in its styling contract; preserve this caller's layout and appearance.
                        className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center p-0 text-xs"
                        variant="secondary"
                      >
                        {activeFilterCount}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  // oxlint-disable-next-line react/forbid-component-props -- PopoverContent accepts className in its styling contract; preserve this caller's layout and appearance.
                  className="p-0"
                >
                  <div className="p-4">
                    <div className="mb-3 flex h-7 items-center justify-between">
                      <div className="text-sm font-medium">Filter by Tools</div>
                      {activeFilterCount > 0 && (
                        <Button
                          // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
                          className="h-6 text-xs"
                          onClick={() => setFeatureFilters(initialFilters)}
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
                          /* oxlint-disable typescript/prefer-readonly-parameter-types -- This reader retains the native React component constructor and callable signatures; the faithful readonly control preserves them and the native rule still flags that graph. */
                          feature: Readonly<(typeof enabledFeatures)[number]>
                          /* oxlint-enable typescript/prefer-readonly-parameter-types */
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
                                onCheckedChange={(checked) =>
                                  setFeatureFilters(
                                    (prev: Readonly<FeatureFilter>) => ({
                                      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing prev own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
                                      ...prev,
                                      [feature.key]: Boolean(checked),
                                    })
                                  )
                                }
                              />
                              <Label
                                // oxlint-disable-next-line react/forbid-component-props -- Label accepts className in its styling contract; preserve this caller's layout and appearance.
                                className="flex items-center gap-1.5 text-sm"
                                htmlFor={feature.key}
                              >
                                <IconComponent
                                  // oxlint-disable-next-line react/forbid-component-props -- IconComponent accepts className in its styling contract; preserve this caller's layout and appearance.
                                  className="h-3.5 w-3.5"
                                />
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
                    // oxlint-disable-next-line react/forbid-component-props -- Label accepts className in its styling contract; preserve this caller's layout and appearance.
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
              // oxlint-disable-next-line react/forbid-component-props -- CommandList accepts className in its styling contract; preserve this caller's layout and appearance.
              className="max-h-[min(40dvh,400px)]"
              onMouseDown={(event: { readonly stopPropagation: () => void }) =>
                event.stopPropagation()
              }
            >
              <CommandEmpty>No model found.</CommandEmpty>
              <CommandGroup>
                {filteredModels.map(
                  ({ model, disabled }: Readonly<ModelItem>) => {
                    const isSelected =
                      /* oxlint-disable no-ternary -- Keep isSelected as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary. */ useMultipleModels /* oxlint-enable no-ternary */
                        ? selectedModelIds.has(model.id)
                        : model.id === optimisticModelId;
                    const count =
                      /* oxlint-disable no-ternary -- Keep count as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary. */ useMultipleModels /* oxlint-enable no-ternary */ &&
                      typeof optimisticSelection !== "string"
                        ? (optimisticSelection[model.id] ?? 0)
                        : undefined;
                    return (
                      <CommandItem
                        // oxlint-disable-next-line no-ternary -- Keep count JSX attribute as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
                        count={isSelected ? count : undefined}
                        disabled={disabled}
                        isSelected={isSelected}
                        key={model.id}
                        model={model}
                        onCountChange={
                          // oxlint-disable-next-line no-ternary -- Keep the mode's optional count handler as a lazy value selection; pinned unicorn/prefer-ternary rejects the if/else assignment alternative.
                          useMultipleModels ? handleCountChange : undefined
                        }
                        onSelect={
                          // oxlint-disable-next-line no-ternary -- Select the mode's memoized model handler without creating a new callback for each row.
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
            {!isAnonymous && (
              <div className="border-t p-2">
                <Button
                  asChild
                  // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
                  className="w-full justify-between"
                  size="sm"
                  variant="ghost"
                >
                  <InternalLink aria-label="Add Models" href="/settings/models">
                    Add Models
                    <ChevronRightIcon
                      // oxlint-disable-next-line react/forbid-component-props -- ChevronRightIcon accepts className in its styling contract; preserve this caller's layout and appearance.
                      className="h-4 w-4"
                    />
                  </InternalLink>
                </Button>
              </div>
            )}
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
};
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ModelSelector); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, no-undefined, react-perf/jsx-no-jsx-as-prop, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/no-multi-comp, typescript/strict-boolean-expressions, unicorn/no-null */

export const ModelSelector = memo(
  PureModelSelector,
  (prev, next) =>
    prev.allowMultiple === next.allowMultiple &&
    prev.selectedModelId === next.selectedModelId &&
    prev.selectedModelSelection === next.selectedModelSelection &&
    prev.className === next.className &&
    prev.onModelSelectionChangeAction === next.onModelSelectionChangeAction
);
/* oxlint-enable import/prefer-default-export, import/no-named-export */

/* oxlint-disable max-lines -- model-selector keeps its cohesive feature and related render helpers together; splitting this module requires a separate public-boundary review. This exception covers the file-length metric. */
