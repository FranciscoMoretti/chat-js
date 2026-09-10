"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { InternalLink } from "@/components/internal-link";
import { Input } from "@/components/ui/input";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export function EveHistoryList({
  items,
}: {
  items: { id: string; title: string }[];
}) {
  const [query, setQuery] = useState("");
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const filtered = items.filter((item) =>
    item.title.toLowerCase().includes(query.toLowerCase())
  );
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Conversations</SidebarGroupLabel>
      <Input
        aria-label="Search conversations"
        className="mb-2"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search conversations…"
        value={query}
      />
      <SidebarMenu>
        {filtered.map((item) => (
          <SidebarMenuItem key={item.id}>
            <SidebarMenuButton
              asChild
              isActive={pathname === `/chat/${item.id}`}
            >
              <InternalLink
                href={`/chat/${item.id}`}
                onNavigate={() => setOpenMobile(false)}
              >
                <span className="truncate">{item.title}</span>
              </InternalLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
      {!filtered.length && (
        <p className="p-2 text-muted-foreground text-sm">
          {query
            ? "No matching conversations."
            : "Your conversations will appear here."}
        </p>
      )}
    </SidebarGroup>
  );
}
