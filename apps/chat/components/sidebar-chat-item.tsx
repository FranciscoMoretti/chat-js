"use client";

import React, { memo, useState } from "react";

import type { JSX as ReactJSX, ReactNode } from "react";

import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

/* oxlint-disable sort-imports -- The combined development and production module-effect trace rejects swapping sonner and @/components/ui/dropdown-menu; keep this adjacent import pair ordered. */
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
/* oxlint-enable sort-imports */

import { ChatMenuItems } from "@/components/chat-menu-items";
import { Input } from "@/components/ui/input";

import { InternalLink } from "@/components/internal-link";

import { ShareDialog } from "@/components/share-button";

/* oxlint-disable sort-imports -- The combined development and production module-effect trace rejects swapping @/components/share-button and @/components/ui/sidebar; keep this adjacent import pair ordered. */
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
/* oxlint-enable sort-imports */
/* oxlint-disable react/jsx-no-literals -- PureSidebarChatItem renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */

/* oxlint-disable max-lines-per-function, no-undefined, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/promise-function-async -- PureSidebarChatItem: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity. */

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
    // oxlint-disable-next-line no-ternary -- Keep chatHref as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    projectId !== null && projectId !== ""
      ? `/project/${chat.projectId}/chat/${chat.id}`
      : `/chat/${chat.id}`;
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(chat.title);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve handleRename's awaited sequencing and rejected-Promise behavior. */
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
  /* oxlint-enable oxc/no-async-await */
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
      {
        // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        isEditing ? (
          <div className="bg-background flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm">
            <Input
              // oxlint-disable-next-line jsx-a11y/no-autofocus -- #536: Choosing inline Rename replaces the sidebar item with this focused title editor.
              autoFocus
              // oxlint-disable-next-line react/forbid-component-props -- Input accepts className in its styling contract; preserve this caller's layout and appearance.
              className="h-auto border-0 bg-transparent p-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              maxLength={255}

              onBlur={() => {
                startEventAction(handleRename);
              }}
              onChange={(event: {
                readonly target: { readonly value: string };
              }) => setEditTitle(event.target.value)}
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
        )
      }

      <DropdownMenu modal>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction
            // oxlint-disable-next-line react/forbid-component-props -- SidebarMenuAction accepts className in its styling contract; preserve this caller's layout and appearance.
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
            // oxlint-disable-next-line no-ternary -- Keep onDelete JSX attribute as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
            onDelete={onDelete ? (): void => onDelete(chat.id) : undefined}
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
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (SidebarChatItem); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable max-lines-per-function, no-undefined, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/promise-function-async */
/* oxlint-disable max-statements -- SidebarChatItem: max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation */

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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable max-statements */
