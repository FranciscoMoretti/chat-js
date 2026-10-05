"use client";

import { Pencil, Trash2 } from "lucide-react";
import React from "react";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
/* oxlint-enable sort-imports */

interface ProjectMenuItemsProps {
  readonly onDelete: () => void;
  readonly onRename: () => void;
}
/* oxlint-disable react/jsx-no-literals -- ProjectMenuItems renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */

export const ProjectMenuItems = ({
  onRename,
  onDelete,
}: ProjectMenuItemsProps): React.JSX.Element => (
  <>
    <DropdownMenuItem
      // oxlint-disable-next-line react/forbid-component-props -- DropdownMenuItem accepts className in its styling contract; preserve this caller's layout and appearance.
      className="cursor-pointer"
      onClick={onRename}
    >
      <Pencil size={16} />
      <span>Rename</span>
    </DropdownMenuItem>
    <DropdownMenuItem
      // oxlint-disable-next-line react/forbid-component-props -- DropdownMenuItem accepts className in its styling contract; preserve this caller's layout and appearance.
      className="text-destructive focus:bg-destructive/15 focus:text-destructive cursor-pointer"
      onSelect={onDelete}
    >
      <Trash2 size={16} />
      <span>Delete</span>
    </DropdownMenuItem>
  </>
);
/* oxlint-enable react/jsx-no-literals */
