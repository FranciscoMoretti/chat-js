"use client";

import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ResponseChoiceSlot = {
  id: string;
  modelName: string;
  selected: boolean;
  loading: boolean;
  statusLabel: string;
  disabled?: boolean;
  onSelect: () => void;
};

/** Layout only: controllers own ordering, lifecycle, and selection. */
export function ResponseChoiceCards({
  slots,
}: {
  slots: readonly ResponseChoiceSlot[];
}) {
  if (slots.length === 0) {
    return null;
  }
  return (
    <div className="mt-3 flex flex-wrap justify-end gap-2">
      {slots.map((slot) => (
        <Button
          aria-pressed={slot.selected}
          className={cn(
            "h-auto min-w-[160px] flex-col items-start gap-1 rounded-xl px-3 py-2 text-left",
            slot.selected && "border-primary bg-primary/5 text-primary"
          )}
          disabled={slot.disabled}
          key={slot.id}
          onClick={slot.onSelect}
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
}
