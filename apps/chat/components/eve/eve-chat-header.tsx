"use client";
import {
  PluginChatBreadcrumb,
  PluginChatActions,
} from "@/components/plugin-chat-ui";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Share } from "lucide-react";
import React, { useState } from "react";
import type { JSX as ReactJSX } from "react";
import { toast } from "sonner";

import { ChatHeaderView } from "@/components/chat-header-view";
import { ChatMenuItems } from "@/components/chat-menu-items";
import { ShareDialog } from "@/components/share-button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTRPC } from "@/trpc/react";

import { useEveDeletion } from "./eve-deletion-provider";
import { EveShareButton, EveShareDialogContent } from "./eve-share-dialog";
import { useEveMetadataMutations } from "./use-eve-metadata-mutations";

const EveSharedBadge = (): React.JSX.Element => (
  <Tooltip>
    <TooltipTrigger asChild>
      <div className="bg-muted/50 text-muted-foreground flex items-center gap-1.5 rounded-md px-2 py-1 text-sm">
        <Share className="opacity-70" size={14} />
        <span>Shared</span>
      </div>
    </TooltipTrigger>
    <TooltipContent>
      <div className="text-center">
        <div className="font-medium">Shared Chat</div>
        <div className="text-muted-foreground mt-1 text-xs">
          This is a shared chat
        </div>
      </div>
    </TooltipContent>
  </Tooltip>
);

const EveChatHeader = ({
  chatId,
  conversationId,
  fallbackTitle,
  hasMessages,
}: {
  readonly chatId: string;
  readonly conversationId: string;
  readonly fallbackTitle: string;
  readonly hasMessages: boolean;
}): ReactJSX.Element => {
  const trpc = useTRPC();
  const identity = useQuery(trpc.eve.get.queryOptions({ id: chatId }));
  const { rename, pin } = useEveMetadataMutations();
  const openDeletion = useEveDeletion();
  const [draft, setDraft] = useState<string>();
  const [sharing, setSharing] = useState(false);
  const title = identity.data?.title ?? fallbackTitle;
  const save = (): void => {
    if (draft === undefined) {
      return;
    }
    const next = draft.trim();
    setDraft(undefined);
    if (next && next !== title) {
      rename.mutate(
        { id: chatId, title: next },
        {
          onSuccess: () => {
            toast.success("Chat renamed successfully");
          },
        }
      );
    }
  };
  return (
    <>
      <ChatHeaderView
        actions={
          hasMessages && (
            <EveShareButton
              chatId={conversationId}
              className="hidden md:flex"
            />
          )
        }
        breadcrumb={
          <Breadcrumb className="ml-2 min-w-0">
            <BreadcrumbList className="flex-nowrap">
              <PluginChatBreadcrumb chatId={chatId} />
              <BreadcrumbItem className="min-w-0">
                {draft === undefined ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        aria-label={`Chat menu: ${title}`}
                        className="group text-foreground hover:bg-muted focus-visible:ring-ring flex min-w-0 items-center gap-1.5 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium transition focus-visible:ring-1 focus-visible:outline-none"
                        type="button"
                      >
                        <span className="truncate">{title}</span>
                        <ChevronDown
                          aria-hidden
                          className="text-muted-foreground size-4 shrink-0"
                        />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <ChatMenuItems
                        pluginActions={
                          <PluginChatActions
                            chat={{ id: chatId, title, state: "bound" }}
                          />
                        }
                        isPinned={identity.data?.isPinned ?? false}
                        onRename={() => {
                          setDraft(title);
                        }}
                        onTogglePin={() => {
                          pin.mutate({
                            id: chatId,
                            isPinned: !(identity.data?.isPinned === true),
                          });
                        }}
                        onDelete={() => {
                          openDeletion({
                            id: conversationId,
                            scope: "conversation",
                            parentHref: identity.data?.parentHref,
                            state: "bound",
                            title,
                          });
                        }}
                        onShare={() => {
                          setSharing(true);
                        }}
                        showShare={hasMessages}
                      />
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Input
                    aria-label="Chat title"
                    autoFocus
                    className="bg-background h-7 w-[220px] px-2 py-1 text-sm"
                    maxLength={255}
                    value={draft}
                    onChange={(event: {
                      readonly target: { readonly value: string };
                    }) => {
                      setDraft(event.target.value);
                    }}
                    onBlur={save}
                    onKeyDown={(event: {
                      readonly key: string;
                      readonly preventDefault: () => void;
                    }) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        save();
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        setDraft(undefined);
                      }
                    }}
                  />
                )}
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
      />
      <ShareDialog
        open={sharing}
        onOpenChange={setSharing}
        renderContent={(onClose): React.JSX.Element => (
          <EveShareDialogContent chatId={conversationId} onClose={onClose} />
        )}
      />
    </>
  );
};

export { EveChatHeader, EveSharedBadge };
