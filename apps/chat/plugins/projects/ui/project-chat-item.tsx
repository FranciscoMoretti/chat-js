"use client";
import { pluginRoute } from "@/lib/plugin-route";

import { formatDistance } from "date-fns";

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import React, { useState, useSyncExternalStore } from "react";
import type { JSX as ReactJSX } from "react";

import { Button } from "@/components/ui/button";
import { ChatRenameDialog } from "@/components/chat-rename-dialog";
import { InternalLink } from "@/components/internal-link";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

// Share a sampled clock across rows and keep the hydration snapshot deterministic.
let currentTime: number | null = null;
const timeListeners = new Set<() => void>();
let clockInterval: ReturnType<typeof setInterval> | undefined;

const updateCurrentTime = (): void => {
  currentTime = Date.now();
  for (const listener of timeListeners) {
    listener();
  }
};

const subscribeToTime = (listener: () => void): (() => void) => {
  timeListeners.add(listener);
  if (timeListeners.size === 1) {
    updateCurrentTime();
    clockInterval = setInterval(updateCurrentTime, 30_000);
  }
  return () => {
    timeListeners.delete(listener);
    if (timeListeners.size === 0) {
      clearInterval(clockInterval);
      clockInterval = undefined;
    }
  };
};

const getCurrentTime = (): number | null => currentTime;
const getServerTime = (): null => null;

export const ProjectChatItem = ({
  chat,
  onDelete,
  onRename,
  pluginActions,
}: {
  readonly chat: {
    readonly id: string;
    readonly title: string;
    readonly href?: string;
    readonly updatedAt?: ReadonlyNativeSurface<Date> | string;
  };
  readonly onDelete?: (chatId: string) => void;
  readonly pluginActions?: React.ReactNode;
  readonly onRename: (chatId: string, title: string) => Promise<void>;
}): ReactJSX.Element => {
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const referenceTime = useSyncExternalStore(
    subscribeToTime,
    getCurrentTime,
    getServerTime
  );
  const chatHref = chat.href ?? `/chat/${chat.id}`;

  const handleRename = async (title: string): Promise<void> => {
    await onRename(chat.id, title);
  };

  const lastMessageText =
    referenceTime !== null &&
    chat.updatedAt !== undefined &&
    chat.updatedAt !== ""
      ? formatDistance(
          new Date(chat.updatedAt),
          Math.max(referenceTime, new Date(chat.updatedAt).getTime()),
          {
            addSuffix: true,
          }
        )
      : "";

  return (
    <>
      <div className="group relative">
        <div className="hover:bg-muted/50 relative flex items-center gap-3 px-4 py-3 transition-colors">
          <InternalLink
            aria-label={chat.title}
            className="absolute inset-0 z-10"
            href={pluginRoute(chatHref)}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{chat.title}</div>
            <div className="text-muted-foreground text-xs">
              {lastMessageText}
            </div>
          </div>
          <div className="z-20">
            <DropdownMenu modal>
              <DropdownMenuTrigger
                render={
                  <Button
                    className="h-7 w-7 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100"
                    size="icon"
                    type="button"
                    variant="ghost"
                  />
                }
              >
                <MoreHorizontal size={16} />
                <span className="sr-only">More</span>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" side="bottom">
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => {
                      setRenameDialogOpen(true);
                    }}
                  >
                    <Pencil size={16} />
                    <span>Rename</span>
                  </DropdownMenuItem>

                  {pluginActions}

                  {onDelete && (
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => {
                        onDelete(chat.id);
                      }}
                    >
                      <Trash2 size={16} />
                      <span>Delete</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

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
