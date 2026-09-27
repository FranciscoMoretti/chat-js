"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";
import { useTRPC } from "@/trpc/react";

import { EveSearchResultsView } from "./eve-search-results-view";
import { useDebouncedSearch } from "./use-debounced-search";

const SearchResults = ({
  onSelect,
  onClose,
  ownerId,
}: {
  onSelect: (id: string) => void;
  onClose: () => void;
  ownerId: string;
}) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const search = useDebouncedSearch(query);
  const history = useInfiniteQuery(
    trpc.eve.list.infiniteQueryOptions(
      { ownerScope: ownerId },
      {
        enabled: !query.trim(),
        getNextPageParam: (page) => page.nextCursor,
        refetchOnWindowFocus: false,
        staleTime: 0,
      }
    )
  );
  const results = useInfiniteQuery(
    trpc.eve.search.infiniteQueryOptions(
      { ownerScope: ownerId, search },
      {
        enabled: Boolean(search) && search === query.trim(),
        getNextPageParam: (page) => page.nextCursor,
        refetchOnWindowFocus: false,
        staleTime: 0,
        trpc: { abortOnUnmount: true },
      }
    )
  );
  const isSearch = Boolean(query.trim());
  const active = isSearch ? results : history;
  const changingQuery = query.trim() !== search;
  const waiting =
    changingQuery ||
    active.isPending ||
    (active.isFetching && !active.isFetchingNextPage);
  const failed = !changingQuery && active.isError;
  const recentItems =
    history.data?.pages
      .flatMap((page) => page.items)
      .filter((item) => item.state === "bound")
      .map((item) => ({
        ...item,
        conversationId: item.conversationId ?? item.id,
        excerpt: "",
      })) ?? [];
  const matchedItems = results.data?.pages.flatMap((page) => page.items) ?? [];
  const currentItems = isSearch ? matchedItems : recentItems;
  const items = waiting || failed ? [] : currentItems;
  const seen = new Set<string>();
  const distinct = items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
  return (
    <EveSearchResultsView
      onClose={onClose}
      query={query}
      onQueryChange={(value) => {
        if (value.trim() !== query.trim()) {
          // Cancel immediately, not after the debounce: an old response must
          // never publish while the user is already typing a different query.
          void queryClient.cancelQueries({
            exact: true,
            queryKey: trpc.eve.search.infiniteQueryKey({
              ownerScope: ownerId,
              search,
            }),
          });
        }
        setQuery(value);
      }}
      searching={waiting}
      pending={waiting && !failed}
      error={failed}
      items={distinct}
      isSearch={isSearch}
      onSelect={onSelect}
      onRetry={() => active.refetch()}
      hasMore={!waiting && !failed && Boolean(active.hasNextPage)}
      loadingMore={active.isFetchingNextPage}
      onLoadMore={() => active.fetchNextPage()}
      disableLoadMore={active.isFetching || changingQuery}
    />
  );
};

const searchShortcut = () =>
  navigator.platform.toUpperCase().includes("MAC") ? "Cmd+K" : "Ctrl+K";
const subscribePlatform = () => () => null;
const serverShortcut = () => "Ctrl+K";

export const EveSearchChats = ({ ownerId }: { ownerId?: string }) => {
  const shortcut = useSyncExternalStore(
    subscribePlatform,
    searchShortcut,
    serverShortcut
  );
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);
  return (
    <>
      <SidebarMenuButton tooltip="Search chats" onClick={() => setOpen(true)}>
        <SearchIcon className="size-4" />
        <span>Search chats</span>
        <span className="text-muted-foreground ml-auto text-xs">
          {shortcut}
        </span>
      </SidebarMenuButton>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="overflow-hidden p-0"
          showCloseButton={!ownerId}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Search chats</DialogTitle>
            <DialogDescription>
              Search your conversation history.
            </DialogDescription>
          </DialogHeader>
          {open && !ownerId && (
            <p className="text-muted-foreground p-4 text-sm">
              Start a chat to see your conversation history.
            </p>
          )}
          {open && ownerId && (
            <SearchResults
              key={ownerId}
              ownerId={ownerId}
              onClose={() => setOpen(false)}
              onSelect={(id) => {
                setOpen(false);
                setOpenMobile(false);
                router.push(`/chat/${id}`);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
