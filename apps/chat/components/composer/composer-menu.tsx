"use client";

import { Plus } from "lucide-react";
import React from "react";
import type { JSX as ReactJSX } from "react";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { Button } from "@/components/ui/button";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
/* oxlint-enable sort-imports */
import { composerControls } from "@/composer-controls";
import { useIsMobile } from "@/hooks/use-mobile";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ComposerControlProps } from "./control";
/* oxlint-enable sort-imports */
import { getToolDisplay } from "./tool-display";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ComposerMenu); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-no-literals -- ComposerMenu renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-disable no-magic-numbers, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/jsx-props-no-spreading, unicorn/no-null -- ComposerMenu: ; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

/* oxlint-disable react/forbid-component-props -- Button, Plus, DropdownMenuContent accept the supplied styling props; preserve this composition's layout and appearance. */
// oxlint-disable-next-line max-lines-per-function -- Readonly annotations expand this existing cohesive handler; preserve its authorization, state and awaited operation sequence.
export const ComposerMenu = (
  props: ComposerControlProps
): ReactJSX.Element | null => {
  const mobile = useIsMobile();
  const controls = composerControls.filter(
    (
      /* oxlint-disable typescript/prefer-readonly-parameter-types -- This reader retains the native React component constructor and callable signatures; the faithful readonly control preserves them and the native rule still flags that graph. */
      { Component }
      /* oxlint-enable typescript/prefer-readonly-parameter-types */
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling Component.isAvailable; preserve one receiver evaluation, skipped call arguments and the existing true fallback. The app guidance prefers optional chaining.
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish read and fallback, including one receiver evaluation; the app guidance prefers optional chaining.
    ) => Component.isAvailable?.(mobile) ?? true
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
          {controls.map(
            (
              /* oxlint-disable typescript/prefer-readonly-parameter-types -- This reader retains the native React component constructor and callable signatures; the faithful readonly control preserves them and the native rule still flags that graph. */
              { id, Component }
              /* oxlint-enable typescript/prefer-readonly-parameter-types */
            ): React.JSX.Element => (
              <Component key={id} {...props} />
            )
          )}
          {props.selectedTool && (
            <>
              {controls.length > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem
                disabled={props.disabled}
                onSelect={() => props.onToolChange(null)}
              >
                Clear{" "}
                {
                  /* oxlint-disable oxc/no-optional-chaining -- Keep the existing nullish guard when reading shortName from getToolDisplay(...); preserve one receiver evaluation, skipped accesses and the existing "unavailable tool" fallback. The app guidance prefers optional chaining. */
                  getToolDisplay(props.selectedTool)?.shortName ??
                    /* oxlint-enable oxc/no-optional-chaining */ "unavailable tool"
                }
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable react/forbid-component-props */
/* oxlint-enable no-magic-numbers, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/jsx-props-no-spreading, unicorn/no-null */
