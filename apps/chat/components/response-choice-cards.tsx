"use client";

import { LoaderCircle } from "lucide-react";
import React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ResponseChoiceSlot {
  id: string;
  modelName: string;
  selected: boolean;
  loading: boolean;
  statusLabel: string;
  disabled?: boolean;
  handleSelect: () => void;
}
/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, no-magic-numbers, react/jsx-max-depth, typescript/prefer-readonly-parameter-types, unicorn/no-null -- ResponseChoiceCards: jsdoc/require-param: the TypeScript signature describes these parameters; the prose documents behavior rather than duplicate tags; jsdoc/require-returns: the inferred or annotated return type describes the value; the prose documents behavior rather than duplicate tags; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { slots, }: { slots: readonly ResponseChoiceSlot[]; }); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

/** Layout only: controllers own ordering, lifecycle, and selection. */
export const ResponseChoiceCards = ({
  slots,
}: {
  slots: readonly ResponseChoiceSlot[];
}): React.JSX.Element | null => {
  if (slots.length === 0) {
    return null;
  }
  return (
    <div className="mt-3 flex flex-wrap justify-end gap-2">
      {slots.map((slot): React.JSX.Element => (
        <Button
          aria-pressed={slot.selected}
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
            {slot.loading ? (
              <LoaderCircle aria-hidden className="size-3 animate-spin" />
            ) : null}
            {slot.statusLabel}
          </span>
        </Button>
      ))}
    </div>
  );
};
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, no-magic-numbers, react/jsx-max-depth, typescript/prefer-readonly-parameter-types, unicorn/no-null */
