"use client";

import {
  ChevronsUpDown,
  DollarSign,
  LogIn,
  LogOut,
  Moon,
  Settings,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { useRouter } from "next/navigation";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import React from "react";
/* oxlint-enable sort-imports */
import type { JSX as ReactJSX } from "react";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { InternalLink } from "@/components/internal-link";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
/* oxlint-enable sort-imports */
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useGetCredits } from "@/hooks/use-credits";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import authClient from "@/lib/auth-client";
/* oxlint-enable sort-imports */
/* oxlint-disable import/max-dependencies -- @/lib/electron-auth import: import/max-dependencies: these direct dependencies compose this feature without hiding imports behind a barrel. */
import { isElectronRenderer } from "@/lib/electron-auth";
/* oxlint-enable import/max-dependencies */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { cn } from "@/lib/utils";
/* oxlint-enable sort-imports */
import { useSession } from "@/providers/session-provider";
/* oxlint-disable react/jsx-no-literals -- SidebarUserNav renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/strict-boolean-expressions, typescript/strict-void-return -- SidebarUserNav: ; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including user.image); typescript/strict-void-return: this library event API ignores the return value while the existing handler owns its async pending and error lifecycle. */

export const SidebarUserNav = (): ReactJSX.Element => {
  const { data: session, isPending } = useSession();
  const { credits } = useGetCredits();
  const { setTheme, resolvedTheme } = useTheme();
  const router = useRouter();
  const { isMobile, state } = useSidebar();
  const isDesktopCollapsed = !isMobile && state === "collapsed";

  const user = session?.user;

  if (isPending) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <div
            aria-hidden="true"
            className="flex h-12 items-center gap-2 rounded-md p-2"
          >
            <div className="bg-sidebar-accent size-8 animate-pulse rounded-lg" />
            <div className="grid flex-1 gap-1 group-data-[collapsible=icon]:hidden">
              <div className="bg-sidebar-accent h-3 w-20 animate-pulse rounded" />
              <div className="bg-sidebar-accent h-3 w-28 animate-pulse rounded" />
            </div>
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  if (!user) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton onClick={() => router.push("/login")}>
            <LogIn
              // oxlint-disable-next-line react/forbid-component-props -- LogIn accepts className in its styling contract; preserve this caller's layout and appearance.
              className="size-4"
            />
            <span>Sign in</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  const displayName = user.name || user.email || "User";
  const userInitials = displayName.slice(0, 2).toUpperCase();
  // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: Empty text or a falsy optional value deliberately selects the fallback; nullish coalescing would preserve that empty value.
  const avatarImageSrc = user.image || `https://avatar.vercel.sh/${user.email}`;

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this return statement's awaited sequencing and rejected-Promise behavior. */
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              // oxlint-disable-next-line react/forbid-component-props -- SidebarMenuButton accepts className in its styling contract; preserve this caller's layout and appearance.
              className={cn(
                "data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground mx-auto",
                isDesktopCollapsed &&
                  "flex flex-col items-center justify-center"
              )}
              size="lg"
            >
              <Avatar
                // oxlint-disable-next-line react/forbid-component-props -- Avatar accepts className in its styling contract; preserve this caller's layout and appearance.
                className={cn(
                  "size-8 rounded-lg",
                  isDesktopCollapsed && "size-6"
                )}
              >
                <AvatarImage alt={displayName} src={avatarImageSrc} />
                <AvatarFallback
                  // oxlint-disable-next-line react/forbid-component-props -- AvatarFallback accepts className in its styling contract; preserve this caller's layout and appearance.
                  className="rounded-lg"
                >
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div
                className={cn(
                  "grid flex-1 text-left text-sm leading-tight",
                  isDesktopCollapsed && "hidden"
                )}
              >
                <span className="truncate font-medium">
                  {user.name || user.email}
                </span>
                <span className="flex items-center gap-1 truncate text-xs">
                  <DollarSign
                    // oxlint-disable-next-line react/forbid-component-props -- DollarSign accepts className in its styling contract; preserve this caller's layout and appearance.
                    className="size-3"
                  />
                  {((credits ?? 0) / 100).toFixed(2)}
                </span>
              </div>
              <ChevronsUpDown
                // oxlint-disable-next-line react/forbid-component-props -- ChevronsUpDown accepts className in its styling contract; preserve this caller's layout and appearance.
                className={cn("ml-auto size-4", isDesktopCollapsed && "hidden")}
              />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            // oxlint-disable-next-line react/forbid-component-props -- DropdownMenuContent accepts className in its styling contract; preserve this caller's layout and appearance.
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel
              // oxlint-disable-next-line react/forbid-component-props -- DropdownMenuLabel accepts className in its styling contract; preserve this caller's layout and appearance.
              className="p-0 font-normal"
            >
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar
                  // oxlint-disable-next-line react/forbid-component-props -- Avatar accepts className in its styling contract; preserve this caller's layout and appearance.
                  className="h-8 w-8 rounded-lg"
                >
                  <AvatarImage alt={displayName} src={avatarImageSrc} />
                  <AvatarFallback
                    // oxlint-disable-next-line react/forbid-component-props -- AvatarFallback accepts className in its styling contract; preserve this caller's layout and appearance.
                    className="rounded-lg"
                  >
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    {user.name || user.email}
                  </span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <InternalLink href="/settings">
                  <Settings
                    // oxlint-disable-next-line react/forbid-component-props -- Settings accepts className in its styling contract; preserve this caller's layout and appearance.
                    className="mr-2 size-4"
                  />
                  Settings
                </InternalLink>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  setTheme(resolvedTheme === "light" ? "dark" : "light")
                }
              >
                {resolvedTheme === "light" ? (
                  <Moon
                    // oxlint-disable-next-line react/forbid-component-props -- Moon accepts className in its styling contract; preserve this caller's layout and appearance.
                    className="mr-2 size-4"
                  />
                ) : (
                  <Sun
                    // oxlint-disable-next-line react/forbid-component-props -- Sun accepts className in its styling contract; preserve this caller's layout and appearance.
                    className="mr-2 size-4"
                  />
                )}
                Toggle Theme
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              // oxlint-disable-next-line typescript/no-misused-promises -- #585: Sign-out coordinates Electron session synchronization and navigation; changing failure handling requires authentication lifecycle review.
              onClick={async () => {
                if (
                  isElectronRenderer() &&
                  // oxlint-disable-next-line unicorn/prefer-global-this -- #572: Electron preload exposes this bridge through the augmented Window interface, not a cross-runtime global.
                  typeof window.signOut === "function"
                ) {
                  // oxlint-disable-next-line unicorn/prefer-global-this -- #572: Electron preload exposes this bridge through the augmented Window interface, not a cross-runtime global.
                  await window.signOut();
                  // oxlint-disable-next-line unicorn/prefer-global-this -- #572: Electron preload exposes this bridge through the augmented Window interface, not a cross-runtime global.
                  await window.electronAPI?.syncAuthSession?.();
                } else {
                  await authClient.signOut();
                }
                globalThis.location.href = "/";
              }}
            >
              <LogOut
                // oxlint-disable-next-line react/forbid-component-props -- LogOut accepts className in its styling contract; preserve this caller's layout and appearance.
                className="mr-2 size-4"
              />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
  /* oxlint-enable oxc/no-async-await */
};
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/strict-boolean-expressions, typescript/strict-void-return */
