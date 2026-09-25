import { Cpu } from "lucide-react";
import { headers } from "next/headers";
import { Suspense } from "react";

import { EveHistory } from "@/components/eve/eve-history";
import { EveSearchChats } from "@/components/eve/eve-search-chats";
import { InternalLink } from "@/components/internal-link";
import { NewChatButton } from "@/components/new-chat-button";
import { SidebarProjects } from "@/components/sidebar-projects";
import { SidebarTopRow } from "@/components/sidebar-top-row";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { env } from "@/lib/env";
import { resolveEvePrincipal } from "@/lib/eve/principal";
import { getRegisteredSession } from "@/lib/registered-session";

import { SidebarUserNav } from "./sidebar-user-nav";

const ScopedEveSearch = async () => {
  const principal = await resolveEvePrincipal(await headers());
  return (
    <EveSearchChats
      key={principal?.ownerId ?? "anonymous"}
      ownerId={principal?.ownerId}
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

const RegisteredEveProjects = async () => {
  const session = await getRegisteredSession(await headers());
  return session?.user ? (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Projects</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarProjects />
      </SidebarMenu>
    </SidebarGroup>
  ) : null;
};

export const AppSidebar = () => (
  <Sidebar
    className="grid max-h-dvh grid-rows-[auto_1fr_auto] group-data-[side=left]:border-r-0"
    collapsible="icon"
  >
    <SidebarHeader className="shrink-0">
      <SidebarMenu>
        <div className="flex flex-row items-center justify-between">
          <SidebarTopRow />
        </div>

        <NewChatButton />
        {!env.CHATJS_GUEST_ONLY && (
          <>
            <SidebarMenuItem>
              <Suspense fallback={<Skeleton className="h-8 w-full" />}>
                <ScopedEveSearch />
              </Suspense>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Models">
                <InternalLink href="/settings/models">
                  <Cpu className="size-4" />
                  <span className="group-data-[collapsible=icon]:hidden">
                    Models
                  </span>
                </InternalLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </>
        )}
      </SidebarMenu>
    </SidebarHeader>
    <SidebarSeparator />
    <ScrollArea className="relative flex-1 overflow-y-auto">
      <SidebarContent className="max-w-(--sidebar-width) pr-2 group-data-[collapsible=icon]:hidden">
        <Suspense fallback={<HistorySkeleton />}>
          <RegisteredEveProjects />
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
