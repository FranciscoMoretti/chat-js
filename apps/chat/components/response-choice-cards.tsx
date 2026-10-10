"use client";

import { Button } from "@/components/ui/button";
import { LoaderCircle } from "lucide-react";

import React from "react";

import { cn } from "@/lib/utils";

/* oxlint-disable import/no-named-export -- Keep the named type bindings (ResponseChoiceSlot); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export interface ResponseChoiceSlot {
  id: string;
  modelName: string;
  selected: boolean;
  loading: boolean;
  statusLabel: string;
  disabled?: boolean;
  handleSelect: () => void;
}
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (ResponseChoiceCards); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable no-magic-numbers, react/jsx-max-depth, unicorn/no-null -- ResponseChoiceCards: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

/**
 * Layout only: controllers own ordering, lifecycle, and selection.
 * @param {{ readonly slots: readonly Readonly<ResponseChoiceSlot>[]; }} props Response-card layout inputs.
 * @param {readonly Readonly<ResponseChoiceSlot>[]} props.slots Controller-owned ordered choices and selection callbacks.
 * @returns {React.JSX.Element | null} Choice buttons, or null when the controller provides no slots.
 */
export const ResponseChoiceCards = ({
  slots,
}: {
  readonly slots: readonly Readonly<ResponseChoiceSlot>[];
}): React.JSX.Element | null => {
  if (slots.length === 0) {
    return null;
  }
  return (
    <div className="mt-3 flex flex-wrap justify-end gap-2">
      {slots.map((slot): React.JSX.Element => (
        <Button
          aria-pressed={slot.selected}
          // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
          className={cn(
            "h-auto min-w-[160px] flex-col items-start gap-1 rounded-xl px-3 py-2 text-left",
            slot.selected && "border-primary bg-primary/5 text-primary"
          )}
          disabled={slot.disabled}
          key={slot.id}
          onClick={slot.handleSelect}
          type="button"
          variant="outline"
        >
          <span className="text-sm font-medium">{slot.modelName}</span>
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            {
              // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
              slot.loading ? (
                <LoaderCircle
                  aria-hidden
                  // oxlint-disable-next-line react/forbid-component-props -- LoaderCircle accepts className in its styling contract; preserve this caller's layout and appearance.
                  className="size-3 animate-spin"
                />
              ) : null
            }
            {slot.statusLabel}
          </span>
        </Button>
      ))}
    </div>
  );
};
/* oxlint-enable import/no-named-export */
/* oxlint-enable no-magic-numbers, react/jsx-max-depth, unicorn/no-null */
