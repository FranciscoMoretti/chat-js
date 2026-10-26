"use client";
import { pluginRoute } from "@/lib/plugin-route";

import React, { memo, useState } from "react";

import type { JSX as ReactJSX } from "react";

import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { ChatMenuItems } from "@/components/chat-menu-items";
import { Input } from "@/components/ui/input";

import { InternalLink } from "@/components/internal-link";

import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const PureSidebarChatItem = ({
  chat,
  isActive,
  onDelete,
  pluginActions,
  onRename,
  onPin,
  setOpenMobile,
  prefetch = false,
}: {
  readonly chat: {
    readonly id: string;
    readonly title: string;
    readonly isPinned: boolean;
    readonly href?: string;
  };
  readonly isActive: boolean;
  readonly onDelete?: (chatId: string) => void;
  readonly pluginActions?: React.ReactNode;
  readonly onRename: (chatId: string, title: string) => void | Promise<void>;
  readonly onPin: (chatId: string, isPinned: boolean) => void;
  readonly setOpenMobile: (open: boolean) => void;
  readonly prefetch?: boolean;
}): ReactJSX.Element => {
  const [, startEventAction] = React.useTransition();
  const chatHref = chat.href ?? `/chat/${chat.id}`;
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(chat.title);

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
        <SidebarMenuButton
          isActive={isActive}
          render={
            <InternalLink
              href={pluginRoute(chatHref)}
              onNavigate={() => {
                setOpenMobile(false);
              }}
              prefetch={prefetch}
            >
              <span>{chat.title}</span>
            </InternalLink>
          }
        />
      )}

      <DropdownMenu modal>
        <DropdownMenuTrigger
          render={
            <SidebarMenuAction
              className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground mr-0.5"
              showOnHover={!isActive}
            />
          }
        >
          <MoreHorizontal size={16} />
          <span className="sr-only">More</span>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" side="bottom">
          <DropdownMenuGroup>
            <ChatMenuItems
              isPinned={chat.isPinned}
              onDelete={
                onDelete
                  ? (): void => {
                      onDelete(chat.id);
                    }
                  : undefined
              }
              pluginActions={pluginActions}
              onRename={() => {
                setIsEditing(true);
                setEditTitle(chat.title);
              }}
              onTogglePin={() => {
                onPin(chat.id, !chat.isPinned);
              }}
            />
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
};

export const SidebarChatItem = memo(
  PureSidebarChatItem,
  (prevProps, nextProps) => {
    if (
      prevProps.onDelete !== nextProps.onDelete ||
      prevProps.pluginActions !== nextProps.pluginActions ||
      prevProps.onRename !== nextProps.onRename ||
      prevProps.onPin !== nextProps.onPin ||
      prevProps.chat.href !== nextProps.chat.href
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
