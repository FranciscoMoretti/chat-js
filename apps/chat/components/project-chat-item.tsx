"use client";

import { formatDistance } from "date-fns";

import { FolderInput, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import React, { useState } from "react";
import type { JSX as ReactJSX, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ChatRenameDialog } from "@/components/chat-rename-dialog";
import { InternalLink } from "@/components/internal-link";

import { ShareDialog } from "@/components/share-button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import { ShareMenuItem } from "@/components/upgrade-cta/share-menu-item";

export const ProjectChatItem = ({
  chat,
  onDelete,
  onRename,
  onMoveProject,
  renderShareContent,
}: {
  readonly chat: {
    readonly id: string;
    readonly title: string;
    readonly projectId: string | null;
    readonly updatedAt?: ReadonlyNativeSurface<Date> | string;
  };
  readonly onDelete?: (chatId: string) => void;
  readonly onMoveProject?: () => void;
  readonly renderShareContent: (
    chatId: string,
    onClose: () => void
  ) => ReactNode;
  readonly onRename: (chatId: string, title: string) => Promise<void>;
}): ReactJSX.Element => {
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const chatHref: `/project/${string}/chat/${string}` = `/project/${chat.projectId}/chat/${chat.id}`;

  const handleRename = async (title: string): Promise<void> => {
    await onRename(chat.id, title);
  };

  const lastMessageText =
    chat.updatedAt !== undefined && chat.updatedAt !== ""
      ? formatDistance(new Date(chat.updatedAt), new Date(), {
          addSuffix: true,
        })
      : "";

  return (
    <>
      <div className="group relative">
        <div className="hover:bg-muted/50 relative flex items-center gap-3 px-4 py-3 transition-colors">
          <InternalLink
            aria-label={chat.title}
            className="absolute inset-0 z-10"
            href={chatHref}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{chat.title}</div>
            <div className="text-muted-foreground text-xs">
              {lastMessageText}
            </div>
          </div>
          <div className="z-20">
            <DropdownMenu modal>
              <DropdownMenuTrigger asChild>
                <Button
                  className="h-7 w-7 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100"
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <MoreHorizontal size={16} />
                  <span className="sr-only">More</span>
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" side="bottom">
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => {
                    setRenameDialogOpen(true);
                  }}
                >
                  <Pencil size={16} />
                  <span>Rename</span>
                </DropdownMenuItem>

                {onMoveProject && (
                  <DropdownMenuItem onClick={onMoveProject}>
                    <FolderInput size={16} />
                    <span>Move to project</span>
                  </DropdownMenuItem>
                )}

                <ShareMenuItem
                  onShare={() => {
                    setShareDialogOpen(true);
                  }}
                />

                {onDelete && (
                  <DropdownMenuItem
                    className="text-destructive focus:bg-destructive/15 focus:text-destructive cursor-pointer"
                    onSelect={() => {
                      onDelete(chat.id);
                    }}
                  >
                    <Trash2 size={16} />
                    <span>Delete</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      {shareDialogOpen && (
        <ShareDialog
          onOpenChange={setShareDialogOpen}
          open={shareDialogOpen}
          // oxlint-disable-next-line typescript/promise-function-async -- ReactNode includes promises, but this render callback must retain synchronous element results for the client share dialog.
          renderContent={(onClose) => renderShareContent(chat.id, onClose)}
        />
      )}

      {renameDialogOpen && (
        <ChatRenameDialog
          currentTitle={chat.title}
          isLoading={false}
          onOpenChange={setRenameDialogOpen}
          onSubmit={handleRename}
          open={renameDialogOpen}
        />
      )}
    </>
  );
};
