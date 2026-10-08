"use client";

import { PlusIcon } from "lucide-react";
import React from "react";
import type { JSX as ReactJSX } from "react";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
/* oxlint-enable sort-imports */
import { cn } from "@/lib/utils";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (FollowUpSuggestionsView); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-no-literals -- FollowUpSuggestionsView renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-disable max-lines-per-function, no-magic-numbers, react/jsx-max-depth, unicorn/no-null -- FollowUpSuggestionsView: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

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
      <Suggestions
        // oxlint-disable-next-line react/forbid-component-props -- Suggestions accepts className in its styling contract; preserve this caller's layout and appearance.
        className="gap-1.5"
      >
        {(() => {
          const seen = new Map<string, number>();
          return suggestions.map((suggestion) => {
            const count = seen.get(suggestion) ?? 0;
            seen.set(suggestion, count + 1);
            const key =
              /* oxlint-disable no-ternary -- Keep key as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary. */ count /* oxlint-enable no-ternary */ ===
              0
                ? suggestion
                : `${suggestion}-${count}`;
            return (
              <Suggestion
                // oxlint-disable-next-line react/forbid-component-props -- Suggestion accepts className in its styling contract; preserve this caller's layout and appearance.
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
                <PlusIcon
                  // oxlint-disable-next-line react/forbid-component-props -- PlusIcon accepts className in its styling contract; preserve this caller's layout and appearance.
                  className="size-3 opacity-70"
                />
              </Suggestion>
            );
          });
        })()}
      </Suggestions>
    </fieldset>
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable max-lines-per-function, no-magic-numbers, react/jsx-max-depth, unicorn/no-null */
