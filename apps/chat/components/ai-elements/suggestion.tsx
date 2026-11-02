"use client";

import type { ComponentProps, JSX as ReactJSX } from "react";
import { Button } from "@/components/ui/button";
import React from "react";
import { cn } from "@/lib/utils";

type SuggestionsProps = (Omit<ComponentProps<"div">, "className"> & { className?: string });

const Suggestions = ({
  className,
  children,
  ...props
}: SuggestionsProps): React.JSX.Element => (
  <div className={cn("flex w-full gap-2 overflow-x-auto overscroll-x-contain scroll-fade-x scrollbar-none", className)} {...props}>
    {children}
  </div>
);

type SuggestionProps = Omit<(Omit<ComponentProps<typeof Button>, "className"> & { className?: string }), "onClick"> & {
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
      className={cn("shrink-0", className)}
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
