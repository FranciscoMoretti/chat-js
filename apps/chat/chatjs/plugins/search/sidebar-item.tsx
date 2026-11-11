"use client";
import { SidebarMenuItem } from "@/components/ui/sidebar";
import { EveSearchChats } from "./search-chats";

export const SearchSidebarItem = ({
  ownerId,
  onChatSelect,
}: {
  readonly ownerId?: string;
  readonly onChatSelect?: (id: string) => void;
}) => (
  <SidebarMenuItem>
    <EveSearchChats
      key={ownerId ?? "anonymous"}
      ownerId={ownerId}
      onChatSelect={onChatSelect}
    />
  </SidebarMenuItem>
);
