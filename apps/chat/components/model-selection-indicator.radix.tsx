"use client";
import { Checkbox } from "@/components/ui/checkbox";

/** The command row owns activation; this checkbox only displays its selection. */
export const ModelSelectionIndicator = ({
  selected,
}: {
  readonly selected: boolean;
}) => (
  <Checkbox
    aria-hidden
    tabIndex={-1}
    aria-readonly
    checked={selected}
    className="pointer-events-none"
  />
);
