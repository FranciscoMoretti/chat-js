"use client";
import { SidebarMenuItem } from "@/components/ui/sidebar";
import { EveSearchChats } from "./search-chats";

export const SearchSidebarItem = ({
  ownerId,
}: {
  readonly ownerId?: string;
}) => (
  <SidebarMenuItem>
    <EveSearchChats key={ownerId ?? "anonymous"} ownerId={ownerId} />
  </SidebarMenuItem>
);
