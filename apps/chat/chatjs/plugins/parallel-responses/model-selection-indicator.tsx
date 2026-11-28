import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** The option exposes selection. Its checkmark is purely visual. */
export const ModelSelectionIndicator = ({
  selected,
}: {
  readonly selected: boolean;
}) => (
  <span
    aria-hidden="true"
    className={cn(
      "bg-input/90 grid size-4 shrink-0 place-items-center rounded-[5px]",
      selected && "bg-primary text-primary-foreground"
    )}
  >
    {selected && <CheckIcon className="size-3.5" />}
  </span>
);
