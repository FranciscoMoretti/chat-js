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
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
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
import { useGetCredits } from "@/hooks/chat-sync-hooks";
import authClient from "@/lib/auth-client";
import { isElectronRenderer } from "@/lib/electron-auth";
import { cn } from "@/lib/utils";
import { useSession } from "@/providers/session-provider";

export function SidebarUserNav() {
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
          <SidebarMenuButton className="pointer-events-none" size="lg">
            <div className="size-8 animate-pulse rounded-lg bg-sidebar-accent" />
            <div className="grid flex-1 gap-1 group-data-[collapsible=icon]:hidden">
              <div className="h-3 w-20 animate-pulse rounded bg-sidebar-accent" />
              <div className="h-3 w-28 animate-pulse rounded bg-sidebar-accent" />
            </div>
          </SidebarMenuButton>
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
  const avatarImageSrc = user.image || `https://avatar.vercel.sh/${user.email}`;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              className={cn(
                "mx-auto data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground",
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
              onClick={async () => {
                if (
                  isElectronRenderer() &&
                  typeof window.signOut === "function"
                ) {
                  await window.signOut();
                  await window.electronAPI?.syncAuthSession?.();
                } else {
                  await authClient.signOut();
                }
                window.location.href = "/";
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
}
