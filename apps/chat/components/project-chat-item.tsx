"use client";

import { formatDistance } from "date-fns";
import { FolderInput, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

import { ChatRenameDialog } from "@/components/chat-rename-dialog";
import { InternalLink } from "@/components/internal-link";
import { ShareDialog } from "@/components/share-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ShareMenuItem } from "@/components/upgrade-cta/share-menu-item";
import type { UIChat } from "@/lib/types/ui-chat";

export const ProjectChatItem = ({
  chat,
  onDelete,
  onRename,
  onMoveProject,
  renderShareContent,
}: {
  chat: Pick<UIChat, "id" | "title" | "projectId"> & {
    updatedAt?: Date | string;
  };
  onDelete?: (chatId: string) => void;
  onMoveProject?: () => void;
  renderShareContent?: (chatId: string, onClose: () => void) => ReactNode;
  onRename: (chatId: string, title: string) => Promise<void>;
}) => {
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const chatHref: `/project/${string}/chat/${string}` = `/project/${chat.projectId}/chat/${chat.id}`;

  const handleRename = async (title: string) => {
    await onRename(chat.id, title);
  };

  const lastMessageText = chat.updatedAt
    ? `${formatDistance(new Date(chat.updatedAt), new Date(), {
        addSuffix: true,
      })}`
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
            <DropdownMenu modal={true}>
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
                  onClick={() => setRenameDialogOpen(true)}
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

                <ShareMenuItem onShare={() => setShareDialogOpen(true)} />

                {onDelete && (
                  <DropdownMenuItem
                    className="text-destructive focus:bg-destructive/15 focus:text-destructive cursor-pointer"
                    onSelect={() => onDelete(chat.id)}
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
          chatId={chat.id}
          onOpenChange={setShareDialogOpen}
          open={shareDialogOpen}
          renderContent={
            renderShareContent
              ? (onClose) => renderShareContent(chat.id, onClose)
              : undefined
          }
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
