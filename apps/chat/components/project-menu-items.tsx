"use client";

import { Pencil, Trash2 } from "lucide-react";
import React from "react";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

interface ProjectMenuItemsProps {
  onDelete: () => void;
  onRename: () => void;
}
/* oxlint-disable typescript/prefer-readonly-parameter-types -- ProjectMenuItems: ; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { onRename, onDelete, }: ProjectMenuItemsProps). */

export const ProjectMenuItems = ({
  onRename,
  onDelete,
}: ProjectMenuItemsProps): React.JSX.Element => (
  <>
    <DropdownMenuItem className="cursor-pointer" onClick={onRename}>
      <Pencil size={16} />
      <span>Rename</span>
    </DropdownMenuItem>
    <DropdownMenuItem
      className="text-destructive focus:bg-destructive/15 focus:text-destructive cursor-pointer"
      onSelect={onDelete}
    >
      <Trash2 size={16} />
      <span>Delete</span>
    </DropdownMenuItem>
  </>
);
/* oxlint-enable typescript/prefer-readonly-parameter-types */
