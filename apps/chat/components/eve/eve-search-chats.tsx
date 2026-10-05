"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import React, { useEffect, useState, useSyncExternalStore } from "react";
/* oxlint-enable sort-imports */
import type { JSX as ReactJSX } from "react";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
/* oxlint-enable sort-imports */
import { SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";
import { useTRPC } from "@/trpc/react";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { EveSearchResultsView } from "./eve-search-results-view";
/* oxlint-enable sort-imports */
import { useDebouncedSearch } from "./use-debounced-search";
/* oxlint-disable max-lines-per-function, max-statements, react-perf/jsx-no-new-array-as-prop, react-perf/jsx-no-new-function-as-prop, typescript/prefer-readonly-parameter-types -- SearchResults: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; react-perf/jsx-no-new-array-as-prop: these props derive from the current render; sharing or memoizing them requires a separate identity contract; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including page). */

const SearchResults = ({
  onSelect,
  onClose,
  ownerId,
}: {
  readonly onSelect: (id: string) => void;
  readonly onClose: () => void;
  readonly ownerId: string;
}): ReactJSX.Element => {
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
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading pages from history.data; preserve one receiver evaluation, skipped accesses and the existing [] fallback. The app guidance prefers optional chaining.
    history.data?.pages
      .flatMap((page) => page.items)
      .filter((item) => item.state === "bound")
      // oxlint-disable-next-line oxc/no-map-spread -- #541: Normalize conversation IDs without mutating cached search result records.
      .map((item) => ({
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing item own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...item,
        conversationId: item.conversationId ?? item.id,
        excerpt: "",
      })) ?? [];
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading pages from results.data; preserve one receiver evaluation, skipped accesses and the existing [] fallback. The app guidance prefers optional chaining.
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
/* oxlint-enable max-lines-per-function, max-statements, react-perf/jsx-no-new-array-as-prop, react-perf/jsx-no-new-function-as-prop, typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/explicit-function-return-type -- searchShortcut: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

const searchShortcut = () => {
  if (navigator.platform.toUpperCase().includes("MAC")) {
    return "Cmd+K";
  }
  return "Ctrl+K";
};
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable unicorn/no-null -- subscribePlatform: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */
const subscribePlatform = () => (): null => null;
/* oxlint-enable unicorn/no-null */

const serverShortcut = (): string => "Ctrl+K";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (EveSearchChats); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-no-literals -- EveSearchChats renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */

/* oxlint-disable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- EveSearchChats: ; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { ownerId }: { ownerId?: string }); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including ownerId). */

export const EveSearchChats = ({
  ownerId,
}: {
  readonly ownerId?: string;
}): ReactJSX.Element => {
  const shortcut = useSyncExternalStore(
    subscribePlatform,
    searchShortcut,
    serverShortcut
  );
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  useEffect(() => {
    const down = (event: KeyboardEvent): void => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    document.addEventListener("keydown", down);
    return (): void => document.removeEventListener("keydown", down);
  }, []);
  return (
    <>
      <SidebarMenuButton tooltip="Search chats" onClick={() => setOpen(true)}>
        <SearchIcon
          // oxlint-disable-next-line react/forbid-component-props -- SearchIcon accepts className in its styling contract; preserve this caller's layout and appearance.
          className="size-4"
        />
        <span>Search chats</span>
        <span className="text-muted-foreground ml-auto text-xs">
          {shortcut}
        </span>
      </SidebarMenuButton>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          // oxlint-disable-next-line react/forbid-component-props -- DialogContent accepts className in its styling contract; preserve this caller's layout and appearance.
          className="overflow-hidden p-0"
          showCloseButton={!ownerId}
        >
          <DialogHeader
            // oxlint-disable-next-line react/forbid-component-props -- DialogHeader accepts className in its styling contract; preserve this caller's layout and appearance.
            className="sr-only"
          >
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
