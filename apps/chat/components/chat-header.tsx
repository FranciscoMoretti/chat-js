"use client";
import { Share } from "lucide-react";
import { memo, type ReactNode } from "react";
import { HeaderActions } from "@/components/header-actions";
import { HeaderBreadcrumb } from "@/components/header-breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { Session } from "@/lib/auth";
import type { ChatRouteSource } from "@/lib/chat-route";
import type { UIChat } from "@/lib/types/ui-chat";
import { cn } from "@/lib/utils";
import { ShareButton } from "./share-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

function PureChatHeader({
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
}) {
  return (
    <ChatHeaderView
      actions={
        <>
          {!isReadonly && hasMessages && chat && (
            <ShareButton chatId={chatId} className="hidden md:flex" />
          )}
          {isReadonly && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1 text-muted-foreground text-sm">
                  <Share className="opacity-70" size={14} />
                  <span>Shared</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-center">
                  <div className="font-medium">Shared Chat</div>
                  <div className="mt-1 text-muted-foreground text-xs">
                    This is a shared chat
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          )}
        </>
      }
      breadcrumb={
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
      }
      className={className}
    />
  );
}
export const ChatHeader = memo(PureChatHeader);

export function ChatHeaderView({
  breadcrumb,
  actions,
  className,
}: {
  breadcrumb: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 flex items-center justify-between gap-2 bg-background px-2 py-1.5 md:px-2",
        className
      )}
    >
      <div className="flex flex-1 items-center justify-between gap-2 overflow-hidden">
        <div className="flex min-w-0 items-center gap-2">
          <SidebarTrigger className="md:hidden" />
          {breadcrumb}
        </div>
        {actions}
      </div>
      <HeaderActions />
    </header>
  );
}
