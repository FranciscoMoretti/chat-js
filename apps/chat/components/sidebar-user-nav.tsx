"use client";

import {
  AccountMenuTrigger,
  AccountMenuContent,
} from "@/components/sidebar-menus";
import { MenuLink } from "@/components/navigation-links";
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

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import {
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { AccountSummary } from "@/components/chat-slots";

import authClient from "@/lib/auth-client";

import { cn } from "@/lib/utils";
import { signOutWithPlugin } from "@/integrations/sign-out";

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
          <AccountMenuTrigger collapsed={isDesktopCollapsed}>
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
              <AccountSummary />
            </div>
            <ChevronsUpDown
              className={cn("ml-auto size-4", isDesktopCollapsed && "hidden")}
            />
          </AccountMenuTrigger>
          <AccountMenuContent side={isMobile ? "bottom" : "right"}>
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
              <MenuLink href="/settings">
                <Settings className="mr-2 size-4" />
                Settings
              </MenuLink>
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
                    await signOutAndNavigate({
                      navigate: () => {
                        globalThis.location.href = "/";
                      },
                      onFailure: () => {
                        toast.error("Unable to sign out. Try again.");
                      },
                      signOut: async () => {
                        if (!(await signOutWithPlugin())) {
                          await authClient.signOut({
                            fetchOptions: { throw: true },
                          });
                        }
                      },
                    });
                  });
                }}
              >
                <LogOut className="mr-2 size-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </AccountMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};
