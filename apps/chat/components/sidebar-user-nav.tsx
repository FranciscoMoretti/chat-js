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
import { useRouter } from "next/navigation";
import type { JSX as ReactJSX } from "react";
import React from "react";
import { toast } from "sonner";

import { InternalLink } from "@/components/internal-link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
/* oxlint-disable import/max-dependencies -- This sidebar integration composes navigation, auth, credits and sign-out feedback through their existing modules. */
import authClient from "@/lib/auth-client";
/* oxlint-enable import/max-dependencies */
/* oxlint-disable import/max-dependencies -- @/lib/electron-auth import: import/max-dependencies: these direct dependencies compose this feature without hiding imports behind a barrel. */
import { isElectronRenderer } from "@/lib/electron-auth";
/* oxlint-enable import/max-dependencies */
import { cn } from "@/lib/utils";
import { useSession } from "@/providers/session-provider";
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
            <LogIn className="size-4" />
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

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              className={cn(
                "data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground mx-auto",
                isDesktopCollapsed &&
                  "flex flex-col items-center justify-center"
              )}
              size="lg"
            >
              <Avatar
                className={cn(
                  "size-8 rounded-lg",
                  isDesktopCollapsed && "size-6"
                )}
              >
                <AvatarImage alt={displayName} src={avatarImageSrc} />
                <AvatarFallback className="rounded-lg">
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
                  <DollarSign className="size-3" />
                  {((credits ?? 0) / 100).toFixed(2)}
                </span>
              </div>
              <ChevronsUpDown
                className={cn("ml-auto size-4", isDesktopCollapsed && "hidden")}
              />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage alt={displayName} src={avatarImageSrc} />
                  <AvatarFallback className="rounded-lg">
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
                  <Settings className="mr-2 size-4" />
                  Settings
                </InternalLink>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  setTheme(resolvedTheme === "light" ? "dark" : "light")
                }
              >
                {resolvedTheme === "light" ? (
                  <Moon className="mr-2 size-4" />
                ) : (
                  <Sun className="mr-2 size-4" />
                )}
                Toggle Theme
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              // oxlint-disable-next-line typescript/no-misused-promises -- #770: React ignores click returns; this awaited sign-out catches bridge/auth failure into an error toast and navigates only after success. prefer-await-to-then rejects a catch-only event adapter.
              onClick={async () => {
                try {
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
                    await authClient.signOut({ fetchOptions: { throw: true } });
                  }
                  globalThis.location.href = "/";
                } catch {
                  toast.error("Unable to sign out. Try again.");
                }
              }}
            >
              <LogOut className="mr-2 size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/strict-boolean-expressions, typescript/strict-void-return */
