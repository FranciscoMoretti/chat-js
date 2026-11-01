"use client";

import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { PlusIcon } from "lucide-react";
import React from "react";

import type { JSX as ReactJSX } from "react";

import { cn } from "@/lib/utils";

export const FollowUpSuggestionsView = ({
  suggestions,
  className,
  onSelect,
  disabled = false,
}: {
  readonly suggestions: readonly string[];
  readonly className?: string;
  readonly onSelect: (suggestion: string) => void;
  readonly disabled?: boolean;
}): ReactJSX.Element | null => {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <fieldset
      aria-label="Related questions"
      className={cn("mt-2 mb-2 flex min-w-0 flex-col gap-2", className)}
    >
      <legend className="text-muted-foreground text-xs font-medium">
        Related
      </legend>
      <Suggestions className="gap-1.5">
        {(() => {
          const seen = new Map<string, number>();
          return suggestions.map((suggestion) => {
            const count = seen.get(suggestion) ?? 0;
            seen.set(suggestion, count + 1);
            const key = count === 0 ? suggestion : `${suggestion}-${count}`;
            return (
              <Suggestion
                className="text-muted-foreground hover:text-foreground h-7"
                disabled={disabled}
                key={key}
                onClick={onSelect}
                size="sm"
                suggestion={suggestion}
                type="button"
                variant="ghost"
              >
                {suggestion}
                <PlusIcon className="size-3 opacity-70" />
              </Suggestion>
            );
          });
        })()}
      </Suggestions>
    </fieldset>
  );
};
