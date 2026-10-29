"use client";
import { ChatActions } from "@/components/chat-slots";
import type { EveHistoryInput } from "@/lib/eve/history-input";

import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { isToday, isYesterday, subMonths, subWeeks } from "date-fns";
import { usePathname } from "next/navigation";
import type { JSX as ReactJSX } from "react";
import React, { useEffect, useRef } from "react";

import { SidebarChatItem } from "@/components/sidebar-chat-item";
import { Button } from "@/components/ui/button";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  useSidebar,
} from "@/components/ui/sidebar";
import type { listEveConversations } from "@/lib/db/eve-queries";
import { pendingEveMetadataMutations } from "@/lib/eve/optimistic-metadata";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { parseChatIdFromPathname } from "@/providers/parse-chat-id-from-pathname";
import { useTRPC } from "@/trpc/react";

import { useEveDeletion } from "./eve-deletion-provider";
import { useEveMetadataMutations } from "./use-eve-metadata-mutations";

const titlePollIntervalMs = 1000;
const titlePollLimitMs = 30_000;

const groupLabel = (
  item: Readonly<
    Pick<
      Awaited<ReturnType<typeof listEveConversations>>["items"][number],
      "updatedAt" | "isPinned"
    >
  >
) => {
  const date = new Date(item.updatedAt);
  if (item.isPinned) {
    return "Pinned";
  }
  if (isToday(date)) {
    return "Today";
  }
  if (isYesterday(date)) {
    return "Yesterday";
  }
  if (date > subWeeks(new Date(), 1)) {
    return "Last 7 days";
  }
  if (date > subMonths(new Date(), 1)) {
    return "Last 30 days";
  }
  return "Older";
};

export const EveHistoryList = ({
  initialPage,
  ownerId,
  input,
  renderItem,
  empty,
}: {
  readonly ownerId: string;
  readonly input?: EveHistoryInput;
  readonly empty?: React.ReactNode;
  readonly renderItem?: (
    item: ReadonlyNativeSurface<
      Awaited<ReturnType<typeof listEveConversations>>["items"][number]
    >,
    index: number
  ) => Exclude<React.ReactNode, Promise<unknown>>;
  readonly initialPage: Awaited<ReturnType<typeof listEveConversations>>;
}): ReactJSX.Element => {
  const trpc = useTRPC();
  const openDeletion = useEveDeletion();
  const queryClient = useQueryClient();
  const search = "";
  const history = useInfiniteQuery(
    trpc.eve.list.infiniteQueryOptions(
      { ownerScope: ownerId, surface: "sidebar", search, ...input },
      {
        getNextPageParam: (page: {
          readonly nextCursor: {
            readonly id: string;
            readonly isPinned: boolean;
            readonly updatedAt: string;
          } | null;
        }) => page.nextCursor,
        initialData: { pageParams: [null], pages: [initialPage] },
      }
    )
  );
  const conversations =
    history.data?.pages.flatMap(
      (
        page: ReadonlyNativeSurface<
          Awaited<ReturnType<typeof listEveConversations>>
        >
      ) => page.items
    ) ?? [];
  const pathname = usePathname();
  const route = parseChatIdFromPathname(pathname);
  const routeId = route.id;
  const selectedIdentity = useQuery(
    trpc.eve.get.queryOptions(
      { id: routeId ?? "" },
      { enabled: route.type === "chat" || route.type === "pluginChat" }
    )
  );
  const hadPendingTitle = useRef(false);
  // oxlint-disable-next-line unicorn/no-useless-undefined -- React requires an initial ref value; undefined represents the uninitialized state.
  const titlePollStartedAt = useRef<number | undefined>(undefined);
  const hasPendingTitle = conversations.some(
    (conversation: {
      readonly titleStatus: "generated" | "manual" | "pending" | "fallback";
    }) => conversation.titleStatus === "pending"
  );
  useEffect((): (() => void) | undefined => {
    if (!hasPendingTitle) {
      if (
        hadPendingTitle.current &&
        pendingEveMetadataMutations(queryClient) === 0
      ) {
        void queryClient.invalidateQueries({
          queryKey: trpc.eve.get.pathKey(),
        });
      }
      hadPendingTitle.current = false;
      titlePollStartedAt.current = undefined;
      return undefined;
    }
    hadPendingTitle.current = true;

    const startedAt = titlePollStartedAt.current ?? Date.now();
    titlePollStartedAt.current = startedAt;
    const remaining = titlePollLimitMs - (Date.now() - startedAt);
    if (remaining <= 0) {
      return undefined;
    }
    const interval = globalThis.setInterval(() => {
      if (pendingEveMetadataMutations(queryClient) === 0) {
        void history.refetch();
      }
    }, titlePollIntervalMs);
    const timeout = globalThis.setTimeout(() => {
      globalThis.clearInterval(interval);
      if (pendingEveMetadataMutations(queryClient) === 0) {
        void history.refetch();
      }
    }, remaining);

    return (): void => {
      globalThis.clearInterval(interval);
      globalThis.clearTimeout(timeout);
    };
  }, [hasPendingTitle, history, queryClient, trpc]);
  // Activity can move a row across a loaded page boundary between requests.
  const seen = new Set<string>();
  const filtered = conversations.filter((item: { readonly id: string }) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
  const { rename, pin } = useEveMetadataMutations();
  const grouped = renderItem
    ? [{ items: filtered, label: "" }]
    : [
        "Pinned",
        "Today",
        "Yesterday",
        "Last 7 days",
        "Last 30 days",
        "Older",
      ].map((label) => ({
        items: filtered.filter(
          (item: ReadonlyNativeSurface<(typeof filtered)[number]>) =>
            groupLabel(item) === label
        ),
        label,
      }));
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarGroup
      className={renderItem ? "p-0" : "group-data-[collapsible=icon]:hidden"}
    >
      {!renderItem && <SidebarGroupLabel>Chats</SidebarGroupLabel>}
      {grouped
        .filter(
          (group: Readonly<{ items: readonly unknown[] }>) => group.items.length
        )
        .map(
          (
            group: ReadonlyNativeSurface<(typeof grouped)[number]>
          ): React.JSX.Element => (
            <div className="[&:not(:first-child)]:mt-6" key={group.label}>
              {group.label && (
                <div className="text-sidebar-foreground/50 px-2 py-1 text-xs">
                  {group.label}
                </div>
              )}
              <SidebarMenu>
                {group.items.map(
                  (
                    item: ReadonlyNativeSurface<(typeof group.items)[number]>,
                    index
                  ) => {
                    if (item.state === "deleting") {
                      return (
                        <li className="p-2 text-sm" key={item.id}>
                          <p className="truncate">{item.title}</p>
                          <Button
                            onClick={() => {
                              openDeletion(item);
                            }}
                            size="sm"
                            variant="ghost"
                          >
                            Resume deletion
                          </Button>
                        </li>
                      );
                    }
                    if (renderItem) {
                      return renderItem(item, index);
                    }
                    return (
                      <SidebarChatItem
                        chat={item}
                        isActive={selectedIdentity.data?.chatId === item.id}
                        key={item.id}
                        onDelete={() => {
                          openDeletion(item);
                        }}
                        pluginActions={<ChatActions chat={item} />}
                        onPin={(id, isPinned) => {
                          pin.mutate({ id, isPinned });
                        }}
                        onRename={async (id, title) => {
                          await rename.mutateAsync({ id, title });
                        }}
                        setOpenMobile={setOpenMobile}
                      />
                    );
                  }
                )}
              </SidebarMenu>
            </div>
          )
        )}
      {history.isPending && (
        <output className="text-muted-foreground p-2 text-sm">
          Loading conversations…
        </output>
      )}
      {history.isError && (
        <div className="p-2 text-sm" role="alert">
          <p>Could not load conversations.</p>
          <Button
            onClick={() => {
              if (history.isFetchNextPageError) {
                void history.fetchNextPage();
              } else {
                void history.refetch();
              }
            }}
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

          onClick={() => {
            void history.fetchNextPage();
          }}
          size="sm"
          variant="ghost"
        >
          {history.isFetchingNextPage ? "Loading…" : "Load more conversations"}
        </Button>
      )}
      {!(filtered.length > 0 || history.isPending || history.isError) &&
        (empty ?? (
          <p className="text-muted-foreground px-2 py-4 text-sm">
            Start chatting to see your conversation history!
          </p>
        ))}
    </SidebarGroup>
  );
};
