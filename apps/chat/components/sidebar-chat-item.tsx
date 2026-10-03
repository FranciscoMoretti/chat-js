"use client";

import { MoreHorizontal } from "lucide-react";
import React, { memo, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { ChatMenuItems } from "@/components/chat-menu-items";
import { InternalLink } from "@/components/internal-link";
import { ShareDialog } from "@/components/share-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

/* oxlint-disable max-lines-per-function, no-undefined, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, typescript/strict-void-return -- PureSidebarChatItem: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including event: React.KeyboardEvent); typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including chat.projectId); typescript/strict-void-return: this library event API ignores the return value while the existing handler owns its async pending and error lifecycle. */

const PureSidebarChatItem = ({
  chat,
  isActive,
  onDelete,
  onMoveProject,
  onRename,
  onPin,
  setOpenMobile,
  prefetch = false,
  showShare = true,
  renderShareContent,
}: {
  chat: {
    id: string;
    title: string;
    isPinned: boolean;
    projectId: string | null;
  };
  isActive: boolean;
  onDelete?: (chatId: string) => void;
  onMoveProject?: () => void;
  onRename: (chatId: string, title: string) => void | Promise<void>;
  onPin: (chatId: string, isPinned: boolean) => void;
  setOpenMobile: (open: boolean) => void;
  prefetch?: boolean;
  showShare?: boolean;
  renderShareContent: (chatId: string, onClose: () => void) => ReactNode;
}) => {
  const chatHref: `/project/${string}/chat/${string}` | `/chat/${string}` =
    chat.projectId
      ? `/project/${chat.projectId}/chat/${chat.id}`
      : `/chat/${chat.id}`;
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(chat.title);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  const handleRename = async () => {
    if (editTitle.trim() === "" || editTitle === chat.title) {
      setIsEditing(false);
      setEditTitle(chat.title);
      return;
    }

    try {
      await onRename(chat.id, editTitle.trim());
      setIsEditing(false);
      toast.success("Chat renamed successfully");
    } catch {
      setEditTitle(chat.title);
      setIsEditing(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      void handleRename();
    } else if (event.key === "Escape") {
      setIsEditing(false);
      setEditTitle(chat.title);
    }
  };

  return (
    <SidebarMenuItem>
      {isEditing ? (
        <div className="bg-background flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm">
          <Input
            // oxlint-disable-next-line jsx-a11y/no-autofocus -- #536: Choosing inline Rename replaces the sidebar item with this focused title editor.
            autoFocus
            className="h-auto border-0 bg-transparent p-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
            maxLength={255}

            // oxlint-disable-next-line typescript/no-misused-promises -- #585: Inline rename awaits its parent callback and catches failures before leaving edit mode.
            onBlur={handleRename}
            onChange={(event) => setEditTitle(event.target.value)}
            onKeyDown={handleKeyDown}
            value={editTitle}
          />
        </div>
      ) : (
        <SidebarMenuButton asChild isActive={isActive}>
          <InternalLink
            href={chatHref}
            onNavigate={() => {
              setOpenMobile(false);
            }}
            prefetch={prefetch}
          >
            <span>{chat.title}</span>
          </InternalLink>
        </SidebarMenuButton>
      )}

      <DropdownMenu modal>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground mr-0.5"
            showOnHover={!isActive}
          >
            <MoreHorizontal size={16} />
            <span className="sr-only">More</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" side="bottom">
          <ChatMenuItems
            isPinned={chat.isPinned}
            onDelete={onDelete ? () => onDelete(chat.id) : undefined}
            onMoveProject={onMoveProject}
            onRename={() => {
              setIsEditing(true);
              setEditTitle(chat.title);
            }}
            onShare={() => setShareDialogOpen(true)}
            onTogglePin={() => onPin(chat.id, !chat.isPinned)}
            showShare={showShare}
          />
        </DropdownMenuContent>
      </DropdownMenu>

      {shareDialogOpen && (
        <ShareDialog
          onOpenChange={setShareDialogOpen}
          open={shareDialogOpen}
          renderContent={(onClose) => renderShareContent(chat.id, onClose)}
        />
      )}
    </SidebarMenuItem>
  );
};
/* oxlint-enable max-lines-per-function, no-undefined, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, typescript/strict-void-return */
/* oxlint-disable max-statements, typescript/prefer-readonly-parameter-types -- SidebarChatItem: ; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including prevProps). */

export const SidebarChatItem = memo(
  PureSidebarChatItem,
  (prevProps, nextProps) => {
    if (
      prevProps.showShare !== nextProps.showShare ||
      prevProps.renderShareContent !== nextProps.renderShareContent ||
      prevProps.onDelete !== nextProps.onDelete ||
      prevProps.onMoveProject !== nextProps.onMoveProject ||
      prevProps.onRename !== nextProps.onRename ||
      prevProps.onPin !== nextProps.onPin ||
      prevProps.chat.projectId !== nextProps.chat.projectId
    ) {
      return false;
    }
    if (prevProps.isActive !== nextProps.isActive) {
      return false;
    }
    if (prevProps.prefetch !== nextProps.prefetch) {
      return false;
    }
    if (prevProps.chat.id !== nextProps.chat.id) {
      return false;
    }
    if (prevProps.chat.title !== nextProps.chat.title) {
      return false;
    }
    if (prevProps.chat.isPinned !== nextProps.chat.isPinned) {
      return false;
    }
    return true;
  }
);
/* oxlint-enable max-statements, typescript/prefer-readonly-parameter-types */
