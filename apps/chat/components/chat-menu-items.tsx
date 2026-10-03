"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import { FolderInput, Pencil, PinIcon, Trash2 } from "lucide-react";
import React from "react";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ShareMenuItem } from "@/components/upgrade-cta/share-menu-item";
/* oxlint-enable sort-imports */

interface ChatMenuItemsProps {
  isPinned: boolean;
  onDelete?: () => void;
  onMoveProject?: () => void;
  onRename: () => void;
  onShare?: () => void;
  onTogglePin: () => void;
  showShare?: boolean;
}
/* oxlint-disable import/no-named-export, import/prefer-default-export, no-ternary, react/forbid-component-props, react/jsx-no-literals, typescript/prefer-readonly-parameter-types -- ChatMenuItems: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable (including isPinned ? "fill-current" : ""); react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const ChatMenuItems = ({
  isPinned,
  onRename,
  onTogglePin,
  onDelete,
  onMoveProject,
  onShare,
  showShare = true,
}: ChatMenuItemsProps): React.JSX.Element => (
  <>
    <DropdownMenuItem className="cursor-pointer" onClick={onRename}>
      <Pencil size={16} />
      <span>Rename</span>
    </DropdownMenuItem>

    <DropdownMenuItem className="cursor-pointer" onClick={onTogglePin}>
      <PinIcon className={`size-4 ${isPinned ? "fill-current" : ""}`} />
      <span>{isPinned ? "Unpin" : "Pin"}</span>
    </DropdownMenuItem>

    {onMoveProject && (
      <DropdownMenuItem onClick={onMoveProject}>
        <FolderInput size={16} />
        <span>Move to project</span>
      </DropdownMenuItem>
    )}

    {showShare && onShare && <ShareMenuItem onShare={onShare} />}

    {onDelete && (
      <DropdownMenuItem
        className="text-destructive focus:bg-destructive/15 focus:text-destructive cursor-pointer"
        onSelect={onDelete}
      >
        <Trash2 size={16} />
        <span>Delete</span>
      </DropdownMenuItem>
    )}
  </>
);
/* oxlint-enable import/no-named-export, import/prefer-default-export, no-ternary, react/forbid-component-props, react/jsx-no-literals, typescript/prefer-readonly-parameter-types */
