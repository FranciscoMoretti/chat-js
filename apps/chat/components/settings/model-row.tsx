import React, { memo } from "react";

import { TableCell, TableRow } from "@/components/ui/table";
import { AVAILABLE_FEATURES } from "@/lib/features-config";
import { cn } from "@/lib/utils";
/* oxlint-disable import/no-relative-parent-imports -- ../model-selector-logo import: import/no-relative-parent-imports: the fixture imports its adjacent feature directly without creating a test-only alias. */

import { ModelSelectorLogo } from "../model-selector-logo";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- ../ui/switch import: import/no-relative-parent-imports: the fixture imports its adjacent feature directly without creating a test-only alias. */
import { Switch } from "../ui/switch";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/strict-boolean-expressions -- ModelRow: react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including model.reasoning). */

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
        <TableCell className="w-full py-2.5 pl-0">
          <div className="flex items-center gap-2.5">
            <ModelSelectorLogo modelId={model.id} />
            <span className="text-sm font-medium">{model.name}</span>
            {model.reasoning && (
              <ReasoningIcon
                aria-label={AVAILABLE_FEATURES.reasoning.description}
                className={cn(
                  "text-muted-foreground size-3.5",
                  isEnabled && "text-foreground"
                )}
              />
            )}
          </div>
        </TableCell>
        <TableCell className="py-2.5 pr-0">
          <Switch
            checked={isEnabled}
            onCheckedChange={() => onToggle(model.id, isEnabled)}
          />
        </TableCell>
      </TableRow>
    );
  }
);
/* oxlint-enable react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/strict-boolean-expressions */

ModelRow.displayName = "PureModelRow";
export { ModelRow };
