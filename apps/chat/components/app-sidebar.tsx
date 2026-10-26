import {
  PluginSidebar,
  PluginSidebarHeader,
} from "@/components/plugin-chat-ui";
import components from "@/components.json";
import { settingsItems } from "@/settings-items";
import React, { Suspense } from "react";
import { Cpu } from "lucide-react";

import { EveHistory } from "@/components/eve/eve-history";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";

import { InternalLink } from "@/components/internal-link";
import { NewChatButton } from "@/components/new-chat-button";
import type { JSX as ReactJSX } from "react";
import { SidebarTopRow } from "@/components/sidebar-top-row";

import { ScrollArea } from "@/components/ui/scroll-area";

import { SidebarUserNav } from "./sidebar-user-nav";

import { Skeleton } from "@/components/ui/skeleton";
import { headers } from "next/headers";

import { resolveEvePrincipal } from "@/lib/eve/principal";

const modelSettingsItem = settingsItems.find((item) => item.id === "models");

const ScopedPluginSidebarHeader = async (): Promise<ReactJSX.Element> => {
  const principal = await resolveEvePrincipal(await headers());
  return (
    <PluginSidebarHeader
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
  <Sidebar
    className="grid max-h-dvh grid-rows-[auto_1fr_auto] border-x-0"
    side={components.rtl ? "right" : "left"}
    dir={components.rtl ? "rtl" : "ltr"}
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
          <ScopedPluginSidebarHeader />
        </Suspense>
        {modelSettingsItem && (modelSettingsItem.isVisible?.() ?? true) && (
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Models"
              render={
                <InternalLink aria-label="Models" href={modelSettingsItem.href}>
                  <Cpu className="size-4" />
                  <span className="group-data-[collapsible=icon]:hidden">
                    Models
                  </span>
                </InternalLink>
              }
            />
          </SidebarMenuItem>
        )}
      </SidebarMenu>
    </SidebarHeader>
    <SidebarSeparator />
    <ScrollArea className="relative flex-1 overflow-y-auto">
      <SidebarContent className="max-w-(--sidebar-width) pr-2 group-data-[collapsible=icon]:hidden">
        <Suspense fallback={<HistorySkeleton />}>
          <PluginSidebar />
          <EveHistory />
        </Suspense>
      </SidebarContent>
    </ScrollArea>
    <SidebarSeparator />
    <SidebarFooter>
      <SidebarUserNav />
    </SidebarFooter>
  </Sidebar>
);
