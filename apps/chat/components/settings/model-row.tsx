import React, { memo } from "react";

import { TableCell, TableRow } from "@/components/ui/table";
import { AVAILABLE_FEATURES } from "@/lib/features-config";
import { ModelSelectorLogo } from "@/components/model-selector-logo";

import { Switch } from "@/components/ui/switch";

import { cn } from "@/lib/utils";
/* oxlint-disable react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth -- ModelRow: react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries */

const ModelRow = memo(
  ({
    model,
    isEnabled,
    onToggle,
  }: {
    readonly model: {
      readonly id: string;
      readonly name: string;
      readonly reasoning?: boolean;
    };
    readonly isEnabled: boolean;
    readonly onToggle: (modelId: string, isEnabled: boolean) => void;
  }) => {
    const ReasoningIcon = AVAILABLE_FEATURES.reasoning.icon;

    return (
      <TableRow>
        <TableCell
          // oxlint-disable-next-line react/forbid-component-props -- TableCell accepts className in its styling contract; preserve this caller's layout and appearance.
          className="w-full py-2.5 pl-0"
        >
          <div className="flex items-center gap-2.5">
            <ModelSelectorLogo modelId={model.id} />
            <span className="text-sm font-medium">{model.name}</span>
            {/* oxlint-disable typescript/strict-boolean-expressions -- Preserve model.reasoning's exact false, null, or undefined child without moving its property read. */}
            {model.reasoning && (
              <ReasoningIcon
                aria-label={AVAILABLE_FEATURES.reasoning.description}
                // oxlint-disable-next-line react/forbid-component-props -- ReasoningIcon accepts className in its styling contract; preserve this caller's layout and appearance.
                className={cn(
                  "text-muted-foreground size-3.5",
                  isEnabled && "text-foreground"
                )}
              />
            )}
            {/* oxlint-enable typescript/strict-boolean-expressions */}
          </div>
        </TableCell>
        <TableCell
          // oxlint-disable-next-line react/forbid-component-props -- TableCell accepts className in its styling contract; preserve this caller's layout and appearance.
          className="py-2.5 pr-0"
        >
          <Switch
            checked={isEnabled}
            onCheckedChange={() => onToggle(model.id, isEnabled)}
          />
        </TableCell>
      </TableRow>
    );
  }
);
/* oxlint-enable react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth */

ModelRow.displayName = "PureModelRow";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ModelRow); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { ModelRow };
/* oxlint-enable import/prefer-default-export, import/no-named-export */
