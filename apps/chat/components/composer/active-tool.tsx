"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import { CircleAlert, X } from "lucide-react";
import React from "react";

import { Button } from "@/components/ui/button";
import type { UiToolName } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

import { getToolDisplay } from "./tool-display";
/* oxlint-enable sort-imports */
/* oxlint-disable import/no-named-export, import/prefer-default-export, no-ternary, oxc/no-optional-chaining, react/forbid-component-props, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null -- ActiveTool: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable (including definition ? Clear ${label} tool : "Clear unavailable tool"); oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback (including definition?.icon); react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

export const ActiveTool = ({
  selectedTool,
  disabled,
  onClear,
}: {
  selectedTool: UiToolName | null;
  disabled?: boolean;
  onClear: () => void;
}) => {
  if (!selectedTool) {
    return null;
  }
  const definition = getToolDisplay(selectedTool);
  const Icon = definition?.icon ?? CircleAlert;
  const label = definition?.shortName ?? "Unavailable tool";
  return (
    <Button
      aria-label={definition ? `Clear ${label} tool` : "Clear unavailable tool"}
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
      <Icon className="size-3.5" />
      <span className={cn(definition && "hidden @[500px]:inline")}>
        {label}
      </span>
      <X className="size-3 opacity-70" />
    </Button>
  );
};
/* oxlint-enable import/no-named-export, import/prefer-default-export, no-ternary, oxc/no-optional-chaining, react/forbid-component-props, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null */
