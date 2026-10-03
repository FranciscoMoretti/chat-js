"use client";

import { PlusIcon } from "lucide-react";
import React from "react";

import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { cn } from "@/lib/utils";
/* oxlint-disable id-length, max-lines-per-function, no-magic-numbers, react/jsx-max-depth, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null -- FollowUpSuggestionsView: id-length: retain conventional event, index, and generic identifiers in this existing callback contract; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

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
/* oxlint-enable id-length, max-lines-per-function, no-magic-numbers, react/jsx-max-depth, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null */
