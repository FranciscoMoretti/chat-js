"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useState, useSyncExternalStore } from "react";

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
/* oxlint-disable max-lines-per-function, max-statements, react-perf/jsx-no-new-array-as-prop, react-perf/jsx-no-new-function-as-prop, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types -- SearchResults: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; react-perf/jsx-no-new-array-as-prop: these props derive from the current render; sharing or memoizing them requires a separate identity contract; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including page). */

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
      // oxlint-disable-next-line oxc/no-map-spread -- #541: Normalize conversation IDs without mutating cached search result records.
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

      onRetry={() => {
        void active.refetch();
      }}
      hasMore={!waiting && !failed && active.hasNextPage}
      loadingMore={active.isFetchingNextPage}

      onLoadMore={() => {
        void active.fetchNextPage();
      }}
      disableLoadMore={active.isFetching || changingQuery}
    />
  );
};
/* oxlint-enable max-lines-per-function, max-statements, react-perf/jsx-no-new-array-as-prop, react-perf/jsx-no-new-function-as-prop, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/explicit-function-return-type -- searchShortcut: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

const searchShortcut = () =>
  navigator.platform.toUpperCase().includes("MAC") ? "Cmd+K" : "Ctrl+K";
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable typescript/explicit-function-return-type, unicorn/no-null -- subscribePlatform: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */
const subscribePlatform = () => () => null;
/* oxlint-enable typescript/explicit-function-return-type, unicorn/no-null */

/* oxlint-disable typescript/explicit-function-return-type -- serverShortcut: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */
const serverShortcut = () => "Ctrl+K";
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-disable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- EveSearchChats: ; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { ownerId }: { ownerId?: string }); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including ownerId). */

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
/* oxlint-enable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
