"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ProjectChatItem } from "@/components/project-chat-item";
import { SidebarChatItem } from "@/components/sidebar-chat-item";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  useSidebar,
} from "@/components/ui/sidebar";
import type { listEveConversations } from "@/lib/db/eve-queries";
import { useTRPC } from "@/trpc/react";
import { EveShareDialogContent } from "./eve-share-dialog";

export function EveHistoryList({
  initialPage,
  projectId,
}: {
  projectId?: string;
  initialPage: Awaited<ReturnType<typeof listEveConversations>>;
}) {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const search = query.trim();
  const history = useInfiniteQuery(
    trpc.eve.list.infiniteQueryOptions(
      { search, projectId },
      {
        getNextPageParam: (page) => page.nextCursor,
        initialData: search
          ? undefined
          : { pages: [initialPage], pageParams: [null] },
      }
    )
  );
  const conversations = history.data?.pages.flatMap((page) => page.items) ?? [];
  // Activity can move a row across a loaded page boundary between requests.
  const seen = new Set<string>();
  const filtered = conversations.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: trpc.eve.list.pathKey() });
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
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarGroup
      className={projectId ? "px-0" : "group-data-[collapsible=icon]:hidden"}
    >
      <SidebarGroupLabel>Conversations</SidebarGroupLabel>
      <Input
        aria-label="Search conversations"
        className="mb-2"
        maxLength={255}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search conversations…"
        value={query}
      />
      <SidebarMenu>
        {filtered.map((item) =>
          projectId ? (
            <li key={item.id}>
              <ProjectChatItem
                chat={item}
                onRename={async (id, title) => {
                  await rename.mutateAsync({ id, title });
                }}
                renderShareContent={(chatId, onClose) => (
                  <EveShareDialogContent chatId={chatId} onClose={onClose} />
                )}
              />
            </li>
          ) : (
            <SidebarChatItem
              chat={item}
              isActive={pathname === `/chat/${item.id}`}
              key={item.id}
              onPin={(id, isPinned) => pin.mutate({ id, isPinned })}
              onRename={async (id, title) => {
                await rename.mutateAsync({ id, title });
              }}
              renderShareContent={(chatId, onClose) => (
                <EveShareDialogContent chatId={chatId} onClose={onClose} />
              )}
              setOpenMobile={setOpenMobile}
            />
          )
        )}
      </SidebarMenu>
      {history.isPending && (
        <p className="p-2 text-muted-foreground text-sm" role="status">
          Loading conversations…
        </p>
      )}
      {history.isError && (
        <div className="p-2 text-sm" role="alert">
          <p>Could not load conversations.</p>
          <Button
            onClick={() =>
              history.isFetchNextPageError
                ? history.fetchNextPage()
                : history.refetch()
            }
            size="sm"
            variant="ghost"
          >
            Retry
          </Button>
        </div>
      )}
      {history.hasNextPage && !history.isError && (
        <Button
          className="mt-2"
          disabled={history.isFetching}
          onClick={() => history.fetchNextPage()}
          size="sm"
          variant="ghost"
        >
          {history.isFetchingNextPage ? "Loading…" : "Load more conversations"}
        </Button>
      )}
      {!(filtered.length || history.isPending || history.isError) && (
        <p className="p-2 text-muted-foreground text-sm">
          {query
            ? "No matching conversations."
            : "Your conversations will appear here."}
        </p>
      )}
    </SidebarGroup>
  );
}
