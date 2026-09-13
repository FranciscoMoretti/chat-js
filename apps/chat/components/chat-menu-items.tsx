"use client";

import { FolderInput, Pencil, PinIcon, Trash2 } from "lucide-react";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ShareMenuItem } from "@/components/upgrade-cta/share-menu-item";

interface ChatMenuItemsProps {
  isPinned: boolean;
  onDelete?: () => void;
  onMoveProject?: () => void;
  onRename: () => void;
  onShare?: () => void;
  onTogglePin: () => void;
  showShare?: boolean;
}

export function ChatMenuItems({
  isPinned,
  onRename,
  onTogglePin,
  onDelete,
  onMoveProject,
  onShare,
  showShare = true,
}: ChatMenuItemsProps) {
  return (
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
}
