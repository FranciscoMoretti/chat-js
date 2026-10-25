"use client";

import { Pencil, PinIcon, Trash2 } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

import React from "react";

interface ChatMenuItemsProps {
  readonly isPinned: boolean;
  readonly onDelete?: () => void;
  readonly pluginActions?: React.ReactNode;
  readonly onRename: () => void;
  readonly onTogglePin: () => void;
}

export const ChatMenuItems = ({
  isPinned,
  onRename,
  onTogglePin,
  onDelete,
  pluginActions,
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

    {pluginActions}

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
