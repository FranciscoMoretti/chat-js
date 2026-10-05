"use client";

import { MoreHorizontal } from "lucide-react";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import React, { memo, useState } from "react";
/* oxlint-enable sort-imports */
import type { JSX as ReactJSX, ReactNode } from "react";
import { toast } from "sonner";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { ChatMenuItems } from "@/components/chat-menu-items";
/* oxlint-enable sort-imports */
import { InternalLink } from "@/components/internal-link";
import { ShareDialog } from "@/components/share-button";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
/* oxlint-enable sort-imports */
import { Input } from "@/components/ui/input";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
/* oxlint-enable sort-imports */

/* oxlint-disable max-lines-per-function, no-undefined, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, typescript/strict-void-return -- PureSidebarChatItem: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including event: React.KeyboardEvent); typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including chat.projectId); typescript/strict-void-return: this library event API ignores the return value while the existing handler owns its async pending and error lifecycle. */

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
  const chatHref: `/project/${string}/chat/${string}` | `/chat/${string}` =
    chat.projectId
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
  const handleKeyDown = (event: React.KeyboardEvent): void => {
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
            // oxlint-disable-next-line react/forbid-component-props -- Input accepts className in its styling contract; preserve this caller's layout and appearance.
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
/* oxlint-enable max-lines-per-function, no-undefined, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, typescript/strict-void-return */
/* oxlint-disable max-statements -- SidebarChatItem: ; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including prevProps). */

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
/* oxlint-enable max-statements */
