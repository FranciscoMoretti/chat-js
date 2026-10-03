"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import { PlusIcon } from "lucide-react";
import React from "react";

import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { cn } from "@/lib/utils";
/* oxlint-enable sort-imports */
/* oxlint-disable id-length, import/no-named-export, import/prefer-default-export, max-lines-per-function, no-magic-numbers, no-ternary, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null -- FollowUpSuggestionsView: id-length: retain conventional event, index, and generic identifiers in this existing callback contract; import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable (including count === 0 ? s : ${s}-${count}); react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

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
/* oxlint-enable id-length, import/no-named-export, import/prefer-default-export, max-lines-per-function, no-magic-numbers, no-ternary, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null */
