"use client";

import { PlusIcon } from "lucide-react";

import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { cn } from "@/lib/utils";

export const FollowUpSuggestionsView = ({
  suggestions,
  className,
  onSelect,
  disabled = false,
}: {
  suggestions: string[];
  className?: string;
  onSelect: (suggestion: string) => void;
  disabled?: boolean;
}) => {
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
          return suggestions.map((s) => {
            const count = seen.get(s) ?? 0;
            seen.set(s, count + 1);
            const key = count === 0 ? s : `${s}-${count}`;
            return (
              <Suggestion
                className="text-muted-foreground hover:text-foreground h-7"
                disabled={disabled}
                key={key}
                onClick={onSelect}
                size="sm"
                suggestion={s}
                type="button"
                variant="ghost"
              >
                {s}
                <PlusIcon className="size-3 opacity-70" />
              </Suggestion>
            );
          });
        })()}
      </Suggestions>
    </fieldset>
  );
};
