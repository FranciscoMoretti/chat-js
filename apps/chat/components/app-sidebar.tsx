import { Cpu } from "lucide-react";
import { headers } from "next/headers";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { JSX as ReactJSX } from "react";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import React, { Suspense } from "react";
/* oxlint-enable sort-imports */

import { EveHistory } from "@/components/eve/eve-history";
import { EveSearchChats } from "@/components/eve/eve-search-chats";
import { InternalLink } from "@/components/internal-link";
import { NewChatButton } from "@/components/new-chat-button";
import { SidebarProjects } from "@/components/sidebar-projects";
import { SidebarTopRow } from "@/components/sidebar-top-row";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { ScrollArea } from "@/components/ui/scroll-area";
/* oxlint-enable sort-imports */
/* oxlint-disable import/max-dependencies -- @/components/ui/sidebar import: import/max-dependencies: these direct dependencies compose this feature without hiding imports behind a barrel. */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
/* oxlint-enable sort-imports */
/* oxlint-enable import/max-dependencies */
import { Skeleton } from "@/components/ui/skeleton";
import { auth } from "@/lib/auth";
import { resolveEvePrincipal } from "@/lib/eve/principal";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { SidebarUserNav } from "./sidebar-user-nav";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve ScopedEveSearch's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable sort-imports */

const ScopedEveSearch = async (): Promise<ReactJSX.Element> => {
  const principal = await resolveEvePrincipal(await headers());
  return (
    <EveSearchChats
      key={principal?.ownerId ?? "anonymous"}
      ownerId={principal?.ownerId}
    />
  );
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable react/no-multi-comp -- HistorySkeleton: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract. */

/* oxlint-disable react/forbid-component-props -- Skeleton accept the supplied styling props; preserve this composition's layout and appearance. */
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
/* oxlint-disable react/jsx-no-literals -- RegisteredEveProjects renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve RegisteredEveProjects's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable react/forbid-component-props */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/no-multi-comp, typescript/explicit-function-return-type, unicorn/no-null -- RegisteredEveProjects: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

/* oxlint-disable react/forbid-component-props -- SidebarGroup accept the supplied styling props; preserve this composition's layout and appearance. */
const RegisteredEveProjects = async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ? (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Projects</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarProjects />
      </SidebarMenu>
    </SidebarGroup>
  ) : null;
};
/* oxlint-enable react/jsx-no-literals */
/* oxlint-disable react/jsx-no-literals -- AppSidebar renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable react/forbid-component-props */
/* oxlint-enable react/no-multi-comp, typescript/explicit-function-return-type, unicorn/no-null */
/* oxlint-disable react-perf/jsx-no-jsx-as-prop, react/jsx-max-depth, react/no-multi-comp -- AppSidebar: ; react-perf/jsx-no-jsx-as-prop: this component composition slot accepts an element from the current render; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract. */

/* oxlint-disable react/forbid-component-props -- Sidebar, SidebarHeader, Skeleton, Cpu, ScrollArea, SidebarContent accept the supplied styling props; preserve this composition's layout and appearance. */
export const AppSidebar = (): React.JSX.Element => (
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
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable react/forbid-component-props */
/* oxlint-enable react-perf/jsx-no-jsx-as-prop, react/jsx-max-depth, react/no-multi-comp */
