import React, { Suspense } from "react";
import { Cpu } from "lucide-react";

import { EveHistory } from "@/components/eve/eve-history";

/* oxlint-disable sort-imports -- The combined development and production module-effect trace rejects swapping @/components/eve/eve-history and @/components/ui/sidebar; keep this adjacent import pair ordered. */
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

import { EveSearchChats } from "@/components/eve/eve-search-chats";
import { InternalLink } from "@/components/internal-link";
import { NewChatButton } from "@/components/new-chat-button";
import type { JSX as ReactJSX } from "react";
import { SidebarProjects } from "@/components/sidebar-projects";
import { SidebarTopRow } from "@/components/sidebar-top-row";

/* oxlint-disable sort-imports -- The combined development and production module-effect trace rejects swapping @/components/sidebar-top-row and @/components/ui/scroll-area; keep this adjacent import pair ordered. */
import { ScrollArea } from "@/components/ui/scroll-area";
/* oxlint-enable sort-imports */

/* oxlint-disable import/max-dependencies -- ./sidebar-user-nav import: import/max-dependencies: these direct dependencies compose this feature without hiding imports behind a barrel. */
import { SidebarUserNav } from "./sidebar-user-nav";
/* oxlint-enable import/max-dependencies */

import { Skeleton } from "@/components/ui/skeleton";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

import { resolveEvePrincipal } from "@/lib/eve/principal";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve ScopedEveSearch's awaited sequencing and rejected-Promise behavior. */

const ScopedEveSearch = async (): Promise<ReactJSX.Element> => {
  const principal = await resolveEvePrincipal(await headers());
  return (
    <EveSearchChats
      key={
        /* oxlint-disable oxc/no-optional-chaining -- Keep the existing nullish guard when reading ownerId from principal; preserve one receiver evaluation, skipped accesses and the existing "anonymous" fallback. The app guidance prefers optional chaining. */
        principal?.ownerId ??
        /* oxlint-enable oxc/no-optional-chaining */ "anonymous"
      }
      ownerId={
        /* oxlint-disable oxc/no-optional-chaining -- Keep the existing nullish guard when reading ownerId from principal; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining. */
        principal?.ownerId
        /* oxlint-enable oxc/no-optional-chaining */
      }
    />
  );
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable react/no-multi-comp -- Keep the private search, history placeholder and authenticated projects renderers beside the sidebar that coordinates their Suspense boundaries. */

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

/* oxlint-disable react/no-multi-comp, unicorn/no-null -- RegisteredEveProjects: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

/* oxlint-disable react/forbid-component-props -- SidebarGroup accept the supplied styling props; preserve this composition's layout and appearance. */
const RegisteredEveProjects = async (): Promise<ReactJSX.Element | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading user from session; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  if (session?.user) {
    return (
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel>Projects</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarProjects />
        </SidebarMenu>
      </SidebarGroup>
    );
  }
  return null;
};
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (AppSidebar); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-disable react/jsx-no-literals -- AppSidebar renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable react/forbid-component-props */
/* oxlint-enable react/no-multi-comp, unicorn/no-null */
/* oxlint-disable react-perf/jsx-no-jsx-as-prop, react/jsx-max-depth, react/no-multi-comp -- AppSidebar: react-perf/jsx-no-jsx-as-prop: this component composition slot accepts an element from the current render; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract. */

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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable react/forbid-component-props */
/* oxlint-enable react-perf/jsx-no-jsx-as-prop, react/jsx-max-depth, react/no-multi-comp */
