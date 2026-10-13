"use client";

import type { ComponentProps, JSX as ReactJSX } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import React from "react";
import { cn } from "@/lib/utils";

type SuggestionsProps = ComponentProps<typeof ScrollArea>;

const Suggestions = ({
  className,
  children,
  ...props
}: SuggestionsProps): React.JSX.Element => (
  <ScrollArea className="w-full overflow-x-auto whitespace-nowrap" {...props}>
    <div className={cn("flex w-max flex-nowrap items-center gap-2", className)}>
      {children}
    </div>
    <ScrollBar className="hidden" orientation="horizontal" />
  </ScrollArea>
);

type SuggestionProps = Omit<ComponentProps<typeof Button>, "onClick"> & {
  suggestion: string;
  onClick?: (suggestion: string) => void;
};

const Suggestion = ({
  suggestion,
  onClick,
  className,
  variant = "outline",
  size = "sm",
  children,
  ...props
}: SuggestionProps): ReactJSX.Element => {
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
      className={cn("cursor-pointer rounded-full px-4", className)}
      onClick={handleClick}
      size={size}
      type="button"
      variant={variant}
      {...props}
    >
      {content}
    </Button>
  );
};
export { Suggestion, Suggestions };
export type { SuggestionProps, SuggestionsProps };
