"use client";

import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { isToday, isYesterday, subMonths, subWeeks } from "date-fns";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
  item: Awaited<ReturnType<typeof listEveConversations>>["items"][number]
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
  ownerId: string;
  projectId?: string;
  initialPage: Awaited<ReturnType<typeof listEveConversations>>;
}) => {
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
        getNextPageParam: (page) => page.nextCursor,
        initialData: { pageParams: [null], pages: [initialPage] },
      }
    )
  );
  const conversations = history.data?.pages.flatMap((page) => page.items) ?? [];
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
  const titlePollStartedAt = useRef<number | undefined>(undefined);
  const hasPendingTitle = conversations.some(
    (conversation) => conversation.titleStatus === "pending"
  );
  useEffect(() => {
    if (!hasPendingTitle) {
      if (
        hadPendingTitle.current &&
        pendingEveMetadataMutations(queryClient) === 0
      ) {
        queryClient.invalidateQueries({ queryKey: trpc.eve.get.pathKey() });
      }
      hadPendingTitle.current = false;
      titlePollStartedAt.current = undefined;
      return;
    }
    hadPendingTitle.current = true;
    if (titlePollStartedAt.current === undefined) {
      titlePollStartedAt.current = Date.now();
    }
    const remaining =
      titlePollLimitMs - (Date.now() - titlePollStartedAt.current);
    if (remaining <= 0) {
      return;
    }
    const interval = window.setInterval(() => {
      if (pendingEveMetadataMutations(queryClient) === 0) {
        history.refetch();
      }
    }, titlePollIntervalMs);
    const timeout = window.setTimeout(() => {
      window.clearInterval(interval);
      if (pendingEveMetadataMutations(queryClient) === 0) {
        history.refetch();
      }
    }, remaining);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [hasPendingTitle, history, queryClient, trpc]);
  // Activity can move a row across a loaded page boundary between requests.
  const seen = new Set<string>();
  const filtered = conversations.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
  const { rename, pin } = useEveMetadataMutations();
  const grouped = projectId
    ? [{ items: filtered, label: "" }]
    : [
        "Pinned",
        "Today",
        "Yesterday",
        "Last 7 days",
        "Last 30 days",
        "Older",
      ].map((label) => ({
        items: filtered.filter((item) => groupLabel(item) === label),
        label,
      }));
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarGroup
      className={projectId ? "p-0" : "group-data-[collapsible=icon]:hidden"}
    >
      {!projectId && <SidebarGroupLabel>Chats</SidebarGroupLabel>}
      {grouped
        .filter((group) => group.items.length)
        .map((group) => (
          <div className="[&:not(:first-child)]:mt-6" key={group.label}>
            {group.label && (
              <div className="text-sidebar-foreground/50 px-2 py-1 text-xs">
                {group.label}
              </div>
            )}
            <SidebarMenu>
              {group.items.map((item, index) => {
                if (item.state === "deleting") {
                  return (
                    <li className="p-2 text-sm" key={item.id}>
                      <p className="truncate">{item.title}</p>
                      <Button
                        onClick={() => openDeletion(item)}
                        size="sm"
                        variant="ghost"
                      >
                        Resume deletion
                      </Button>
                    </li>
                  );
                }
                if (projectId) {
                  return (
                    <li key={item.id}>
                      {index > 0 && <Separator />}
                      <ProjectChatItem
                        chat={item}
                        onDelete={() => openDeletion(item)}
                        onMoveProject={
                          session?.user && item.state === "bound"
                            ? () => setMoving(item)
                            : undefined
                        }
                        onRename={async (id, title) => {
                          await rename.mutateAsync({ id, title });
                        }}
                        renderShareContent={(_chatId, onClose) => (
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
                    onDelete={() => openDeletion(item)}
                    onMoveProject={
                      session?.user && item.state === "bound"
                        ? () => setMoving(item)
                        : undefined
                    }
                    onPin={(id, isPinned) => pin.mutate({ id, isPinned })}
                    onRename={async (id, title) => {
                      await rename.mutateAsync({ id, title });
                    }}
                    renderShareContent={(_chatId, onClose) => (
                      <EveShareDialogContent
                        chatId={item.conversationId}
                        onClose={onClose}
                      />
                    )}
                    setOpenMobile={setOpenMobile}
                  />
                );
              })}
            </SidebarMenu>
          </div>
        ))}
      {history.isPending && (
        <output className="text-muted-foreground p-2 text-sm">
          Loading conversations…
        </output>
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
      {!(filtered.length || history.isPending || history.isError) &&
        (projectId ? (
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
          onClose={() => setMoving(undefined)}
        />
      )}
    </SidebarGroup>
  );
};
