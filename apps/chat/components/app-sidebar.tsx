import {
  SidebarSections,
  ModelSettingsLink,
  SidebarHeaderItems,
} from "@/components/chat-slots";
import components from "@/components.json";
import React, { Suspense } from "react";

import { EveHistory } from "@/components/eve/eve-history";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarSeparator,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

import { NewChatButton } from "@/components/new-chat-button";
import type { JSX as ReactJSX } from "react";
import { SidebarTopRow } from "@/components/sidebar-top-row";

import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatSidebarView } from "./chat-sidebar-view";

import { SidebarUserNav } from "./sidebar-user-nav";

import { Skeleton } from "@/components/ui/skeleton";
import { headers } from "next/headers";

import { resolveEvePrincipal } from "@/lib/eve/principal";

const ScopedSidebarHeaderItems = async (): Promise<ReactJSX.Element> => {
  const principal = await resolveEvePrincipal(await headers());
  return (
    <SidebarHeaderItems
      key={principal?.ownerId ?? "anonymous"}
      ownerId={principal?.ownerId}
    />
  );
};

const HistorySkeleton = (): React.JSX.Element => (
  <SidebarGroup>
    <div className="flex flex-col gap-2 px-2">
      <Skeleton className="h-7 w-full" />
      <Skeleton className="h-7 w-5/6" />
      <Skeleton className="h-7 w-4/5" />
      <Skeleton className="h-7 w-full" />
    </div>
  </SidebarGroup>
);

export const AppSidebar = (): React.JSX.Element => (
  <ChatSidebarView
    primitives={{
      Sidebar,
      SidebarContent,
      SidebarFooter,
      SidebarHeader,
      SidebarSeparator,
      ScrollArea,
    }}
    direction={components.rtl ? "rtl" : "ltr"}
    footer={<SidebarUserNav />}
    header={
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
          <ScopedSidebarHeaderItems />
        </Suspense>
        <ModelSettingsLink surface="sidebar" />
      </SidebarMenu>
    }
  >
    <Suspense fallback={<HistorySkeleton />}>
      <SidebarSections />
      <EveHistory />
    </Suspense>
  </ChatSidebarView>
);
