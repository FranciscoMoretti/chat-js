"use client";

import { hasText } from "@/components/text-value";

import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { isToday, isYesterday, subMonths, subWeeks } from "date-fns";
import { usePathname } from "next/navigation";
import type { JSX as ReactJSX } from "react";
import React, { useEffect, useRef, useState } from "react";

import { ProjectChatItem } from "@/components/project-chat-item";
import { SidebarChatItem } from "@/components/sidebar-chat-item";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
import { useSession } from "@/providers/session-provider";
import { useTRPC } from "@/trpc/react";

import { useEveDeletion } from "./eve-deletion-provider";
import { EveMoveProjectDialog } from "./eve-move-project-dialog";
import { EveShareDialogContent } from "./eve-share-dialog";
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
  projectId,
}: {
  readonly ownerId: string;
  readonly projectId?: string;
  readonly initialPage: Awaited<ReturnType<typeof listEveConversations>>;
}): ReactJSX.Element => {
  const trpc = useTRPC();
  const { data: session } = useSession();
  const openDeletion = useEveDeletion();
  const queryClient = useQueryClient();
  const [moving, setMoving] = useState<{
    id: string;
    title: string;
    projectId: string | null;
  }>();
  const search = "";
  const history = useInfiniteQuery(
    trpc.eve.list.infiniteQueryOptions(
      { ownerScope: ownerId, projectId: projectId ?? null, search },
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
      { enabled: route.type === "chat" || route.type === "projectChat" }
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
  const grouped = hasText(projectId)
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
      className={
        hasText(projectId) ? "p-0" : "group-data-[collapsible=icon]:hidden"
      }
    >
      {!hasText(projectId) && <SidebarGroupLabel>Chats</SidebarGroupLabel>}
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
                    if (hasText(projectId)) {
                      return (
                        <li key={item.id}>
                          {index > 0 && <Separator />}
                          <ProjectChatItem
                            chat={item}
                            onDelete={() => {
                              openDeletion(item);
                            }}
                            onMoveProject={
                              session?.user && item.state === "bound"
                                ? () => {
                                    setMoving(item);
                                  }
                                : undefined
                            }
                            onRename={async (id, title) => {
                              await rename.mutateAsync({ id, title });
                            }}
                            renderShareContent={(
                              _chatId,
                              onClose
                            ): React.JSX.Element => (
                              <EveShareDialogContent
                                chatId={item.conversationId}
                                onClose={onClose}
                              />
                            )}
                          />
                        </li>
                      );
                    }
                    return (
                      <SidebarChatItem
                        chat={item}
                        isActive={selectedIdentity.data?.chatId === item.id}
                        key={item.id}
                        onDelete={() => {
                          openDeletion(item);
                        }}
                        onMoveProject={
                          session?.user && item.state === "bound"
                            ? () => {
                                setMoving(item);
                              }
                            : undefined
                        }
                        onPin={(id, isPinned) => {
                          pin.mutate({ id, isPinned });
                        }}
                        onRename={async (id, title) => {
                          await rename.mutateAsync({ id, title });
                        }}
                        renderShareContent={(
                          _chatId,
                          onClose
                        ): React.JSX.Element => (
                          <EveShareDialogContent
                            chatId={item.conversationId}
                            onClose={onClose}
                          />
                        )}
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
        (hasText(projectId) ? (
          <div className="border-border/60 rounded-xl border px-4 py-6">
            <p className="text-foreground text-sm font-medium">
              No chats in this project
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              Start a chat to keep conversations organized and re-use project
              knowledge.
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground px-2 py-4 text-sm">
            Start chatting to see your conversation history!
          </p>
        ))}
      {moving && (
        <EveMoveProjectDialog
          conversation={moving}
          key={moving.id}
          onClose={() => {
            setMoving(undefined);
          }}
        />
      )}
    </SidebarGroup>
  );
};
