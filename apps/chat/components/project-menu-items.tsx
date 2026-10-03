"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import { Pencil, Trash2 } from "lucide-react";
import React from "react";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
/* oxlint-enable sort-imports */

interface ProjectMenuItemsProps {
  onDelete: () => void;
  onRename: () => void;
}
/* oxlint-disable import/no-named-export, import/prefer-default-export, react/forbid-component-props, react/jsx-no-literals, typescript/prefer-readonly-parameter-types -- ProjectMenuItems: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { onRename, onDelete, }: ProjectMenuItemsProps). */

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
/* oxlint-enable import/no-named-export, import/prefer-default-export, react/forbid-component-props, react/jsx-no-literals, typescript/prefer-readonly-parameter-types */
