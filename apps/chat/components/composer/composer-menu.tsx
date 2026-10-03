"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import { Plus } from "lucide-react";
import React from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { composerControls } from "@/composer-controls";
import { useIsMobile } from "@/hooks/use-mobile";

import type { ComposerControlProps } from "./control";
import { getToolDisplay } from "./tool-display";
/* oxlint-enable sort-imports */
/* oxlint-disable import/no-named-export, import/prefer-default-export, no-magic-numbers, oxc/no-optional-chaining, react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, react/jsx-props-no-spreading, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null -- ComposerMenu: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback (including Component.isAvailable?.(mobile)); react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including props: ComposerControlProps); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

export const ComposerMenu = (props: ComposerControlProps) => {
  const mobile = useIsMobile();
  const controls = composerControls.filter(
    ({ Component }) => Component.isAvailable?.(mobile) ?? true
  );
  if (controls.length === 0 && !props.selectedTool) {
    return null;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Composer options"
          className="h-8 gap-2 px-2 @[500px]:h-10"
          disabled={props.disabled}
          size="sm"
          variant="ghost"
        >
          <Plus className="size-4" />
          Add
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuGroup>
          {controls.map(({ id, Component }): React.JSX.Element => (
            <Component key={id} {...props} />
          ))}
          {props.selectedTool && (
            <>
              {controls.length > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem
                disabled={props.disabled}
                onSelect={() => props.onToolChange(null)}
              >
                Clear{" "}
                {getToolDisplay(props.selectedTool)?.shortName ??
                  "unavailable tool"}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
/* oxlint-enable import/no-named-export, import/prefer-default-export, no-magic-numbers, oxc/no-optional-chaining, react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, react/jsx-props-no-spreading, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null */
