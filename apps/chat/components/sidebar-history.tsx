"use client";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
} from "@/components/ui/sidebar";
import { useSession } from "@/providers/session-provider";

import { SidebarChatsList } from "./sidebar-chats-list";
import { SidebarProjects } from "./sidebar-projects";

export const SidebarHistory = () => {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;

  return (
    <>
      {isAuthenticated && (
        <SidebarGroup>
          <SidebarGroupLabel>Projects</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarProjects />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}
      <SidebarGroup>
        <SidebarGroupLabel>Chats</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarChatsList />
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
};
