"use client";

import { CircleAlert, X } from "lucide-react";
import React from "react";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Button } from "@/components/ui/button";
/* oxlint-enable sort-imports */
import type { UiToolName } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

import { getToolDisplay } from "./tool-display";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ActiveTool); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable unicorn/no-null --  unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

export const ActiveTool = ({
  selectedTool,
  disabled,
  onClear,
}: {
  readonly selectedTool: UiToolName | null;
  readonly disabled?: boolean;
  readonly onClear: () => void;
}): React.JSX.Element | null => {
  if (!selectedTool) {
    return null;
  }
  const definition = getToolDisplay(selectedTool);
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading icon from definition; preserve one receiver evaluation, skipped accesses and the existing CircleAlert fallback. The app guidance prefers optional chaining.
  const Icon = definition?.icon ?? CircleAlert;
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading shortName from definition; preserve one receiver evaluation, skipped accesses and the existing "Unavailable tool" fallback. The app guidance prefers optional chaining.
  const label = definition?.shortName ?? "Unavailable tool";
  return (
    <Button
      aria-label={definition ? `Clear ${label} tool` : "Clear unavailable tool"}
      // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn(
        "h-8 gap-1 rounded-full px-2 @[500px]:h-10 @[500px]:gap-2",
        definition ? "text-primary" : "text-destructive"
      )}
      disabled={disabled}
      onClick={onClear}
      size="sm"
      title={label}
      variant="ghost"
    >
      <Icon
        // oxlint-disable-next-line react/forbid-component-props -- Icon accepts className in its styling contract; preserve this caller's layout and appearance.
        className="size-3.5"
      />
      <span className={cn(definition && "hidden @[500px]:inline")}>
        {label}
      </span>
      <X
        // oxlint-disable-next-line react/forbid-component-props -- X accepts className in its styling contract; preserve this caller's layout and appearance.
        className="size-3 opacity-70"
      />
    </Button>
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable unicorn/no-null */
