"use client";

import { Plus } from "lucide-react";
import type { JSX as ReactJSX } from "react";
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
/* oxlint-disable no-magic-numbers, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types, unicorn/no-null -- ComposerMenu: ; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including props: ComposerControlProps); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

export const ComposerMenu = (
  props: ComposerControlProps
): ReactJSX.Element | null => {
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
/* oxlint-enable no-magic-numbers, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types, unicorn/no-null */
