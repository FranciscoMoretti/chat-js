"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Action } from "@/components/ai-elements/actions";

import React from "react";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (MessageSiblingsView); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-no-literals -- MessageSiblingsView renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */

/* oxlint-disable no-magic-numbers, react/jsx-max-depth -- MessageSiblingsView: ; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 1); react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const MessageSiblingsView = ({
  index,
  count,
  disabled = false,
  onPrevious,
  onNext,
}: {
  readonly index: number;
  readonly count: number;
  readonly disabled?: boolean;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
}): React.JSX.Element => (
  <div className="flex items-center justify-center gap-1">
    {count > 1 && (
      <>
        <Action
          // oxlint-disable-next-line react/forbid-component-props -- Action accepts className in its styling contract; preserve this caller's layout and appearance.
          className="text-muted-foreground hover:bg-accent hover:text-accent-foreground h-7 w-7 px-0"
          disabled={disabled || index === 0}
          onClick={onPrevious}
          tooltip="Previous version"
        >
          <ChevronLeft
            // oxlint-disable-next-line react/forbid-component-props -- ChevronLeft accepts className in its styling contract; preserve this caller's layout and appearance.
            className="h-3.5 w-3.5"
          />
        </Action>
        <span className="text-muted-foreground text-xs">
          {index + 1}/{count}
        </span>
        <Action
          // oxlint-disable-next-line react/forbid-component-props -- Action accepts className in its styling contract; preserve this caller's layout and appearance.
          className="text-muted-foreground hover:bg-accent hover:text-accent-foreground h-7 w-7 px-0"
          disabled={disabled || index === count - 1}
          onClick={onNext}
          tooltip="Next version"
        >
          <ChevronRight
            // oxlint-disable-next-line react/forbid-component-props -- ChevronRight accepts className in its styling contract; preserve this caller's layout and appearance.
            className="h-3.5 w-3.5"
          />
        </Action>
      </>
    )}
  </div>
);
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable no-magic-numbers, react/jsx-max-depth */
