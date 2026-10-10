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
import React from "react";

import type { JSX as ReactJSX } from "react";

import { useRouter } from "next/navigation";

import { useTheme } from "next-themes";
/* oxlint-disable sort-imports -- The combined development and production module-effect trace rejects swapping next-themes and sonner; keep this adjacent import pair ordered. */
import { toast } from "sonner";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- The combined development and production module-effect trace rejects swapping sonner and @/components/internal-link; keep this adjacent import pair ordered. */
import { InternalLink } from "@/components/internal-link";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- The combined development and production module-effect trace rejects swapping @/components/internal-link and @/components/ui/avatar; keep this adjacent import pair ordered. */
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

/* oxlint-disable import/max-dependencies -- @/lib/auth-client import: This sidebar directly composes existing navigation, auth and failure owners. */
/* oxlint-disable sort-imports -- The combined development and production module-effect trace rejects swapping @/hooks/use-credits and @/lib/auth-client; keep this adjacent import pair ordered. */
import authClient from "@/lib/auth-client";
/* oxlint-enable import/max-dependencies */
/* oxlint-enable sort-imports */

import { cn } from "@/lib/utils";
import { isElectronRenderer } from "@/lib/electron-auth";

import { signOutAndNavigate } from "@/lib/sign-out";

import { useSession } from "@/providers/session-provider";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (SidebarUserNav); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-no-literals -- SidebarUserNav renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
const USER_INITIALS_LENGTH = 2;
const CREDIT_UNITS_PER_DOLLAR = 100;
const CREDIT_DISPLAY_DECIMAL_PLACES = 2;

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth -- SidebarUserNav: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: initials start at string index zero and an absent credit balance displays zero; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries. */

export const SidebarUserNav = (): ReactJSX.Element => {
  const [, startEventAction] = React.useTransition();
  const { data: session, isPending } = useSession();
  const { credits } = useGetCredits();
  const { setTheme, resolvedTheme } = useTheme();
  const router = useRouter();
  const { isMobile, state } = useSidebar();
  const isDesktopCollapsed = !isMobile && state === "collapsed";

  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading user from session; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
  const userInitials = displayName.slice(0, USER_INITIALS_LENGTH).toUpperCase();
  const { image: userImage } = user;
  const avatarImageSrc =
    // oxlint-disable-next-line no-ternary -- Preserve empty or missing image fallback while checking the optional URL explicitly.
    typeof userImage === "string" && userImage !== ""
      ? userImage
      : `https://avatar.vercel.sh/${user.email}`;

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
                  {((credits ?? 0) / CREDIT_UNITS_PER_DOLLAR).toFixed(
                    CREDIT_DISPLAY_DECIMAL_PLACES
                  )}
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
            // oxlint-disable-next-line no-ternary -- Keep side JSX attribute as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
                  // oxlint-disable-next-line no-ternary -- Keep setTheme argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
                  setTheme(resolvedTheme === "light" ? "dark" : "light")
                }
              >
                {
                  // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
                  resolvedTheme === "light" ? (
                    <Moon
                      // oxlint-disable-next-line react/forbid-component-props -- Moon accepts className in its styling contract; preserve this caller's layout and appearance.
                      className="mr-2 size-4"
                    />
                  ) : (
                    <Sun
                      // oxlint-disable-next-line react/forbid-component-props -- Sun accepts className in its styling contract; preserve this caller's layout and appearance.
                      className="mr-2 size-4"
                    />
                  )
                }
                Toggle Theme
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                startEventAction(async () => {
                  if (
                    isElectronRenderer() &&
                    // oxlint-disable-next-line unicorn/prefer-global-this -- #572: Electron preload exposes this bridge through the augmented Window interface.
                    typeof window.signOut === "function"
                  ) {
                    // oxlint-disable-next-line unicorn/prefer-global-this -- #572: Electron preload exposes this bridge through the augmented Window interface.
                    const nativeSignOut = window.signOut.bind(window);
                    await signOutAndNavigate({
                      navigate: () => {
                        globalThis.location.href = "/";
                      },
                      onFailure: () => {
                        toast.error("Unable to sign out. Try again.");
                      },
                      onSyncFailure: (error) => {
                        // oxlint-disable-next-line no-console -- Native sign-out already completed; retain the failed renderer refresh diagnostic before navigation.
                        console.error(
                          "Failed to refresh the signed-out Electron session",
                          error
                        );
                      },
                      signOut: nativeSignOut,
                      syncSession: async () => {
                        // oxlint-disable-next-line unicorn/prefer-global-this, oxc/no-optional-chaining -- #572: Preserve the optional Electron preload method and its receiver.
                        await window.electronAPI?.syncAuthSession?.();
                      },
                    });
                  } else {
                    await signOutAndNavigate({
                      navigate: () => {
                        globalThis.location.href = "/";
                      },
                      onFailure: () => {
                        toast.error("Unable to sign out. Try again.");
                      },
                      onSyncFailure: (error) => {
                        // oxlint-disable-next-line no-console -- Native sign-out already completed; retain the failed renderer refresh diagnostic before navigation.
                        console.error(
                          "Failed to refresh the signed-out session",
                          error
                        );
                      },
                      signOut: async () => {
                        await authClient.signOut({
                          fetchOptions: { throw: true },
                        });
                      },
                    });
                  }
                });
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth */
