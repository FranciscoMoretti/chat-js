/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import { Cpu } from "lucide-react";
import { headers } from "next/headers";
import React, { Suspense } from "react";

import { EveHistory } from "@/components/eve/eve-history";
import { EveSearchChats } from "@/components/eve/eve-search-chats";
import { InternalLink } from "@/components/internal-link";
import { NewChatButton } from "@/components/new-chat-button";
import { SidebarProjects } from "@/components/sidebar-projects";
import { SidebarTopRow } from "@/components/sidebar-top-row";
import { ScrollArea } from "@/components/ui/scroll-area";
/* oxlint-disable import/max-dependencies -- @/components/ui/sidebar import: import/max-dependencies: these direct dependencies compose this feature without hiding imports behind a barrel. */
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
/* oxlint-enable import/max-dependencies */
import { Skeleton } from "@/components/ui/skeleton";
import { auth } from "@/lib/auth";
import { resolveEvePrincipal } from "@/lib/eve/principal";

import { SidebarUserNav } from "./sidebar-user-nav";
/* oxlint-enable sort-imports */

/* oxlint-disable oxc/no-async-await, oxc/no-optional-chaining, typescript/explicit-function-return-type -- ScopedEveSearch: oxc/no-async-await: await preserves ordered requests and catch behavior in this feature operation; oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback (including principal?.ownerId); typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

const ScopedEveSearch = async () => {
  const principal = await resolveEvePrincipal(await headers());
  return (
    <EveSearchChats
      key={principal?.ownerId ?? "anonymous"}
      ownerId={principal?.ownerId}
    />
  );
};
/* oxlint-enable oxc/no-async-await, oxc/no-optional-chaining, typescript/explicit-function-return-type */
/* oxlint-disable react/forbid-component-props, react/no-multi-comp -- HistorySkeleton: react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract. */

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
/* oxlint-enable react/forbid-component-props, react/no-multi-comp */

/* oxlint-disable no-ternary, oxc/no-async-await, oxc/no-optional-chaining, react/forbid-component-props, react/jsx-no-literals, react/no-multi-comp, typescript/explicit-function-return-type, unicorn/no-null -- RegisteredEveProjects: no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable; oxc/no-async-await: await preserves ordered requests and catch behavior in this feature operation; oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback (including session?.user); react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

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
/* oxlint-enable no-ternary, oxc/no-async-await, oxc/no-optional-chaining, react/forbid-component-props, react/jsx-no-literals, react/no-multi-comp, typescript/explicit-function-return-type, unicorn/no-null */
/* oxlint-disable import/no-named-export, import/prefer-default-export, react-perf/jsx-no-jsx-as-prop, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, react/no-multi-comp -- AppSidebar: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; react-perf/jsx-no-jsx-as-prop: this component composition slot accepts an element from the current render; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract. */

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
/* oxlint-enable import/no-named-export, import/prefer-default-export, react-perf/jsx-no-jsx-as-prop, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, react/no-multi-comp */
