"use client";
import { Suspense, use } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ComponentProps } from "react";
import { ChatAccount } from "./chat-account";
import { EveHistoryList } from "../eve/eve-history-list";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarSeparator,
  SidebarMenu,
  SidebarMenuItem,
  SidebarGroup,
} from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarTopRow } from "@/components/sidebar-top-row";
import { NewChatButton } from "@/components/new-chat-button";
import {
  SidebarSections,
  SidebarHeaderItems,
  ModelSettingsLink,
} from "@/components/chat-slots";

type Owner = string | undefined;
type InitialHistory = ComponentProps<typeof EveHistoryList>["initialPage"];
interface SidebarData {
  readonly ownerId: Owner;
  readonly history: InitialHistory;
}

const HeaderItems = ({
  owner,
  onChatSelect,
}: {
  readonly owner: Owner | Promise<Owner>;
  readonly onChatSelect?: (id: string) => void;
}) => {
  const ownerId =
    typeof owner === "string" || owner === undefined ? owner : use(owner);
  return (
    <SidebarHeaderItems
      key={ownerId ?? "anonymous"}
      ownerId={ownerId}
      onChatSelect={onChatSelect}
    />
  );
};
const History = ({
  data,
}: {
  readonly data: SidebarData | Promise<SidebarData>;
}) => {
  const resolved = "then" in data ? use(data) : data;
  return resolved.ownerId === undefined ? null : (
    <EveHistoryList
      key={resolved.ownerId}
      ownerId={resolved.ownerId}
      initialPage={resolved.history}
    />
  );
};
const HistorySkeleton = () => (
  <SidebarGroup>
    <div className="flex flex-col gap-2 px-2">
      <Skeleton className="h-7 w-full" />
      <Skeleton className="h-7 w-5/6" />
      <Skeleton className="h-7 w-4/5" />
      <Skeleton className="h-7 w-full" />
    </div>
  </SidebarGroup>
);

/** Standard application composition. Inputs describe data and effects; application markup is owned here. */
export const ChatSidebar = ({
  direction = "ltr",
  ownerId,
  history,
  account,
  conversationId,
  onProjectSelect,
  onChatSelect,
}: {
  readonly direction?: "ltr" | "rtl";
  readonly ownerId?: Owner | Promise<Owner>;
  readonly history: SidebarData | Promise<SidebarData>;
  readonly account: ComponentProps<typeof ChatAccount>;
  readonly onChatSelect?: (id: string) => void;
  readonly conversationId?: string;
  readonly onProjectSelect?: (id: string) => void;
}) => (
  <Sidebar
    className="grid max-h-dvh grid-rows-[auto_1fr_auto] border-x-0"
    side={direction === "rtl" ? "right" : "left"}
    dir={direction}
    collapsible="icon"
  >
    <SidebarHeader className="shrink-0">
      <SidebarMenu>
        <div className="flex flex-row items-center justify-between">
          <SidebarTopRow />
        </div>
        <NewChatButton />
        <Suspense
          fallback={
            <SidebarMenuItem>
              <Skeleton className="h-8 w-full" />
            </SidebarMenuItem>
          }
        >
          <HeaderItems owner={ownerId} onChatSelect={onChatSelect} />
        </Suspense>
        <ModelSettingsLink surface="sidebar" />
      </SidebarMenu>
    </SidebarHeader>
    <SidebarSeparator />
    <ScrollArea className="relative flex-1 overflow-y-auto">
      <SidebarContent className="max-w-(--sidebar-width) pr-2 group-data-[collapsible=icon]:hidden">
        <SidebarSections
          conversationId={conversationId}
          onProjectSelect={onProjectSelect}
        />
        <Suspense fallback={<HistorySkeleton />}>
          <History data={history} />
        </Suspense>
      </SidebarContent>
    </ScrollArea>
    <SidebarSeparator />
    <SidebarFooter>
      <ChatAccount {...account} />
    </SidebarFooter>
  </Sidebar>
);
