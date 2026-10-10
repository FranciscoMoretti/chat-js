"use client";

import type { ComponentProps, JSX as ReactJSX } from "react";
import { Button } from "@/components/ui/button";
// oxlint-disable-next-line sort-imports -- Preserve Button-before-ScrollArea order: pinned SWC/Node 24 cold loads keep crypto.randomUUID before ReactDOM hooks (dev) and checkDCE (prod); sorting reverses them.
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import React from "react";
import { cn } from "@/lib/utils";

type SuggestionsProps = ComponentProps<typeof ScrollArea>;

const Suggestions = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    children,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, children from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: SuggestionsProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
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

type SuggestionProps = Omit<ComponentProps<typeof Button>, "onClick"> & {
  suggestion: string;
  onClick?: (suggestion: string) => void;
};

/* oxlint-disable react/no-multi-comp -- Suggestion: this related component stays beside Suggestions; truthy optional children select the existing rendering fallback, with empty strings, 0, and false falling back to suggestion. */

const Suggestion = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    suggestion,
    onClick,
    className,
    variant = "outline",
    size = "sm",
    children,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes suggestion, onClick, className, variant, size, children from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: SuggestionProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => {
  const handleClick = React.useCallback((): void => {
    if (onClick) {
      onClick(suggestion);
    }
  }, [onClick, suggestion]);

  let content: React.ReactNode = suggestion;
  const hasChildren = Boolean(children);
  if (hasChildren) {
    content = children;
  }
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
      {content}
    </Button>
  );
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (Suggestion, Suggestions); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/no-multi-comp */
export { Suggestion, Suggestions };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (SuggestionProps, SuggestionsProps); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { SuggestionProps, SuggestionsProps };
/* oxlint-enable import/no-named-export */
