"use client";

import React, { memo, useState } from "react";

import type { JSX as ReactJSX, ReactNode } from "react";

import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { ChatMenuItems } from "@/components/chat-menu-items";
import { Input } from "@/components/ui/input";

import { InternalLink } from "@/components/internal-link";

import { ShareDialog } from "@/components/share-button";

import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

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
  readonly chat: {
    readonly id: string;
    readonly title: string;
    readonly isPinned: boolean;
    readonly projectId: string | null;
  };
  readonly isActive: boolean;
  readonly onDelete?: (chatId: string) => void;
  readonly onMoveProject?: () => void;
  readonly onRename: (chatId: string, title: string) => void | Promise<void>;
  readonly onPin: (chatId: string, isPinned: boolean) => void;
  readonly setOpenMobile: (open: boolean) => void;
  readonly prefetch?: boolean;
  readonly showShare?: boolean;
  readonly renderShareContent: (
    chatId: string,
    onClose: () => void
  ) => ReactNode;
}): ReactJSX.Element => {
  const [, startEventAction] = React.useTransition();
  const { projectId } = chat;
  const chatHref: `/project/${string}/chat/${string}` | `/chat/${string}` =
    projectId !== null && projectId !== ""
      ? `/project/${chat.projectId}/chat/${chat.id}`
      : `/chat/${chat.id}`;
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(chat.title);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  const handleRename = async (): Promise<void> => {
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
  const handleKeyDown = (
    event: Readonly<Pick<React.KeyboardEvent, "key">>
  ): void => {
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
            autoFocus
            className="h-auto border-0 bg-transparent p-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
            maxLength={255}

            onBlur={() => {
              startEventAction(handleRename);
            }}
            onChange={(event: {
              readonly target: { readonly value: string };
            }) => {
              setEditTitle(event.target.value);
            }}
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
            onDelete={
              onDelete
                ? (): void => {
                    onDelete(chat.id);
                  }
                : undefined
            }
            onMoveProject={onMoveProject}
            onRename={() => {
              setIsEditing(true);
              setEditTitle(chat.title);
            }}
            onShare={() => {
              setShareDialogOpen(true);
            }}
            onTogglePin={() => {
              onPin(chat.id, !chat.isPinned);
            }}
            showShare={showShare}
          />
        </DropdownMenuContent>
      </DropdownMenu>

      {shareDialogOpen && (
        <ShareDialog
          onOpenChange={setShareDialogOpen}
          open={shareDialogOpen}
          // oxlint-disable-next-line typescript/promise-function-async -- ReactNode includes promises, but this render callback must retain synchronous element results for the client share dialog.
          renderContent={(onClose) => renderShareContent(chat.id, onClose)}
        />
      )}
    </SidebarMenuItem>
  );
};

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
