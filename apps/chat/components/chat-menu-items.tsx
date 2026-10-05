"use client";

import { FolderInput, Pencil, PinIcon, Trash2 } from "lucide-react";
import React from "react";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
/* oxlint-enable sort-imports */
import { ShareMenuItem } from "@/components/upgrade-cta/share-menu-item";

interface ChatMenuItemsProps {
  readonly isPinned: boolean;
  readonly onDelete?: () => void;
  readonly onMoveProject?: () => void;
  readonly onRename: () => void;
  readonly onShare?: () => void;
  readonly onTogglePin: () => void;
  readonly showShare?: boolean;
}
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ChatMenuItems); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-no-literals -- ChatMenuItems renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */

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
      className="cursor-pointer"
      onClick={onTogglePin}
    >
      <PinIcon
        // oxlint-disable-next-line react/forbid-component-props -- PinIcon accepts className in its styling contract; preserve this caller's layout and appearance.
        className={`size-4 ${isPinned ? "fill-current" : ""}`}
      />
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
        // oxlint-disable-next-line react/forbid-component-props -- DropdownMenuItem accepts className in its styling contract; preserve this caller's layout and appearance.
        className="text-destructive focus:bg-destructive/15 focus:text-destructive cursor-pointer"
        onSelect={onDelete}
      >
        <Trash2 size={16} />
        <span>Delete</span>
      </DropdownMenuItem>
    )}
  </>
);
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
