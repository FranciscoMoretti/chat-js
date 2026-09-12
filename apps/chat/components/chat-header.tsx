"use client";
import { Share } from "lucide-react";
import { memo } from "react";

import { HeaderActions } from "@/components/header-actions";
import { HeaderBreadcrumb } from "@/components/header-breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { Session } from "@/lib/auth";
import type { ChatRouteSource } from "@/lib/chat-route";
import type { UIChat } from "@/lib/types/ui-chat";
import { cn } from "@/lib/utils";

import { ShareButton } from "./share-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

const PureChatHeader = ({
  chat,
  chatId,
  isReadonly,
  hasMessages,
  projectId,
  routeSource,
  user,
  className,
}: {
  chat?: UIChat | null;
  chatId: string;
  isReadonly: boolean;
  hasMessages: boolean;
  projectId?: string;
  routeSource: ChatRouteSource;
  user?: Session["user"];
  className?: string;
}) => (
  <header
    className={cn(
      "bg-background sticky top-0 flex items-center justify-between gap-2 px-2 py-1.5 md:px-2",
      className
    )}
  >
    <div className="flex flex-1 items-center justify-between gap-2 overflow-hidden">
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        <HeaderBreadcrumb
          chat={chat}
          chatId={chatId}
          className="ml-2"
          hasMessages={hasMessages}
          isReadonly={isReadonly}
          projectId={projectId}
          routeSource={routeSource}
          user={user}
        />
      </div>

      {!isReadonly && hasMessages && chat && (
        <ShareButton chatId={chatId} className="hidden md:flex" />
      )}
      {isReadonly && (
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
      )}
    </div>

    <HeaderActions />
  </header>
);
export const ChatHeader = memo(PureChatHeader);
