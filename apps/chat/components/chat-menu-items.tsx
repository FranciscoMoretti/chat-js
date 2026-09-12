"use client";

import { Pencil, PinIcon, Trash2 } from "lucide-react";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ShareMenuItem } from "@/components/upgrade-cta/share-menu-item";

interface ChatMenuItemsProps {
  isPinned: boolean;
  onDelete: () => void;
  onRename: () => void;
  onShare?: () => void;
  onTogglePin: () => void;
  showShare?: boolean;
}

export const ChatMenuItems = ({
  isPinned,
  onRename,
  onTogglePin,
  onDelete,
  onShare,
  showShare = true,
}: ChatMenuItemsProps) => (
  <>
    <DropdownMenuItem className="cursor-pointer" onClick={onRename}>
      <Pencil size={16} />
      <span>Rename</span>
    </DropdownMenuItem>

    <DropdownMenuItem className="cursor-pointer" onClick={onTogglePin}>
      <PinIcon className={`size-4 ${isPinned ? "fill-current" : ""}`} />
      <span>{isPinned ? "Unpin" : "Pin"}</span>
    </DropdownMenuItem>

    {showShare && onShare && <ShareMenuItem onShare={onShare} />}

    <DropdownMenuItem
      className="text-destructive focus:bg-destructive/15 focus:text-destructive cursor-pointer"
      onSelect={onDelete}
    >
      <Trash2 size={16} />
      <span>Delete</span>
    </DropdownMenuItem>
  </>
);
