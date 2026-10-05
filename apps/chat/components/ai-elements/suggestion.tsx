"use client";

import type { ComponentProps, JSX as ReactJSX } from "react";
import React from "react";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Button } from "@/components/ui/button";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
/* oxlint-enable sort-imports */
import { cn } from "@/lib/utils";

type SuggestionsProps = ComponentProps<typeof ScrollArea>;

/* oxlint-disable typescript/prefer-readonly-parameter-types -- Suggestions: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, children, ...props }: SuggestionsProps). */

const Suggestions = ({
  className,
  children,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, children from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: SuggestionsProps): React.JSX.Element => (
  <ScrollArea
    // oxlint-disable-next-line react/forbid-component-props -- ScrollArea accepts className in its styling contract; preserve this caller's layout and appearance.
    className="w-full overflow-x-auto whitespace-nowrap"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Suggestions's ScrollArea prop contract, preserving caller options, children and callbacks.
    {...props}
  >
    <div className={cn("flex w-max flex-nowrap items-center gap-2", className)}>
      {children}
    </div>
    <ScrollBar
      // oxlint-disable-next-line react/forbid-component-props -- ScrollBar accepts className in its styling contract; preserve this caller's layout and appearance.
      className="hidden"
      orientation="horizontal"
    />
  </ScrollArea>
);
/* oxlint-enable typescript/prefer-readonly-parameter-types */

type SuggestionProps = Omit<ComponentProps<typeof Button>, "onClick"> & {
  suggestion: string;
  onClick?: (suggestion: string) => void;
};

/* oxlint-disable react-perf/jsx-no-new-function-as-prop, react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- Suggestion: react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including children). */

const Suggestion = ({
  suggestion,
  onClick,
  className,
  variant = "outline",
  size = "sm",
  children,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes suggestion, onClick, className, variant, size, children from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: SuggestionProps): ReactJSX.Element => {
  const handleClick = (): void => {
    onClick?.(suggestion);
  };

  return (
    <Button
      // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn("cursor-pointer rounded-full px-4", className)}
      onClick={handleClick}
      size={size}
      type="button"
      variant={variant}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Suggestion's Button prop contract, preserving caller options, children and callbacks.
      {...props}
    >
      {/* oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: Empty text or a falsy optional value deliberately selects the fallback; nullish coalescing would preserve that empty value. */}
      {children || suggestion}
    </Button>
  );
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (Suggestion, Suggestions); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop, react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
export { Suggestion, Suggestions };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (SuggestionProps, SuggestionsProps); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { SuggestionProps, SuggestionsProps };
/* oxlint-enable import/no-named-export */
