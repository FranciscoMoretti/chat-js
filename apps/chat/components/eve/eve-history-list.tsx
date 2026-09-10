"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { SidebarChatItem } from "@/components/sidebar-chat-item";
import { Input } from "@/components/ui/input";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  useSidebar,
} from "@/components/ui/sidebar";
import { useTRPC } from "@/trpc/react";

export function EveHistoryList({
  items,
}: {
  items: { id: string; title: string; isPinned: boolean; projectId: null }[];
}) {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: conversations } = useQuery({
    ...trpc.eve.list.queryOptions(),
    initialData: items,
  });
  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: trpc.eve.list.queryKey() });
    router.refresh();
  }
  const rename = useMutation(
    trpc.eve.rename.mutationOptions({
      onSuccess: refresh,
      onError: (error) => toast.error(error.message),
    })
  );
  const pin = useMutation(
    trpc.eve.pin.mutationOptions({
      onSuccess: refresh,
      onError: (error) => toast.error(error.message),
    })
  );
  const [query, setQuery] = useState("");
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const filtered = conversations.filter((item) =>
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
          <SidebarChatItem
            chat={item}
            isActive={pathname === `/chat/${item.id}`}
            key={item.id}
            onPin={(id, isPinned) => pin.mutate({ id, isPinned })}
            onRename={async (id, title) => {
              await rename.mutateAsync({ id, title });
            }}
            setOpenMobile={setOpenMobile}
            showShare={false}
          />
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
