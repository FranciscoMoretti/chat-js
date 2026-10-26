"use client";

import {
  ChevronsUpDown,
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
import { installedAccountSummaries } from "@/composition/generated/installed-account-ui";

import authClient from "@/lib/auth-client";

import { cn } from "@/lib/utils";
import { isElectronRenderer } from "@/lib/electron-auth";

import { signOutAndNavigate } from "@/lib/sign-out";

import { useSession } from "@/providers/session-provider";

const USER_INITIALS_LENGTH = 2;

export const SidebarUserNav = (): ReactJSX.Element => {
  const [, startEventAction] = React.useTransition();
  const { data: session, isPending } = useSession();
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
          <SidebarMenuButton
            onClick={() => {
              router.push("/login");
            }}
          >
            <LogIn className="size-4" />
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
    typeof userImage === "string" && userImage !== ""
      ? userImage
      : `https://avatar.vercel.sh/${user.email}`;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                className={cn(
                  "data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground mx-auto",
                  isDesktopCollapsed &&
                    "flex flex-col items-center justify-center"
                )}
                size="lg"
              />
            }
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
              {installedAccountSummaries.map(({ id, Component }) => (
                <Component key={id} />
              ))}
            </div>
            <ChevronsUpDown
              className={cn("ml-auto size-4", isDesktopCollapsed && "hidden")}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-[var(--anchor-width)] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuGroup>
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
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem render={<InternalLink href="/settings" />}>
                <Settings className="mr-2 size-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setTheme(resolvedTheme === "light" ? "dark" : "light");
                }}
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
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() => {
                  startEventAction(async () => {
                    if (
                      isElectronRenderer() &&
                      typeof window.signOut === "function"
                    ) {
                      const nativeSignOut = window.signOut.bind(window);
                      await signOutAndNavigate({
                        navigate: () => {
                          globalThis.location.href = "/";
                        },
                        onFailure: () => {
                          toast.error("Unable to sign out. Try again.");
                        },
                        onSyncFailure: (error) => {
                          console.error(
                            "Failed to refresh the signed-out Electron session",
                            error
                          );
                        },
                        signOut: nativeSignOut,
                        syncSession: async () => {
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
                <LogOut className="mr-2 size-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};
