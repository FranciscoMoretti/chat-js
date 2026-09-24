"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
import { useSession } from "@/providers/session-provider";
import { useTRPC } from "@/trpc/react";

import { useEveDeletion } from "./eve-deletion-provider";
import { EveMoveProjectDialog } from "./eve-move-project-dialog";
import { EveShareDialogContent } from "./eve-share-dialog";

const uuidPathSegment =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const titlePollIntervalMs = 1000;
const titlePollLimitMs = 30_000;

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
  const router = useRouter();
  const queryClient = useQueryClient();
  const [moving, setMoving] = useState<{
    id: string;
    title: string;
    projectId: string | null;
  }>();
  const [query, setQuery] = useState("");
  const search = query.trim();
  const history = useInfiniteQuery(
    trpc.eve.list.infiniteQueryOptions(
      { ownerScope: ownerId, projectId: projectId ?? null, search },
      {
        getNextPageParam: (page) => page.nextCursor,
        initialData: search
          ? undefined
          : { pageParams: [null], pages: [initialPage] },
      }
    )
  );
  const conversations = history.data?.pages.flatMap((page) => page.items) ?? [];
  const pathname = usePathname();
  const routeId = pathname.split("/").at(-1);
  const selectedIdentity = useQuery(
    trpc.eve.get.queryOptions(
      { id: routeId ?? "" },
      { enabled: Boolean(routeId && uuidPathSegment.test(routeId)) }
    )
  );
  const hadPendingTitle = useRef(false);
  const titlePollStartedAt = useRef<number | undefined>(undefined);
  const hasPendingTitle = conversations.some(
    (conversation) => conversation.titleStatus === "pending"
  );
  useEffect(() => {
    if (!hasPendingTitle) {
      if (hadPendingTitle.current) {
        router.refresh();
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
      history.refetch();
    }, titlePollIntervalMs);
    const timeout = window.setTimeout(() => {
      window.clearInterval(interval);
      history.refetch();
    }, remaining);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [hasPendingTitle, history, router]);
  // Activity can move a row across a loaded page boundary between requests.
  const seen = new Set<string>();
  const filtered = conversations.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: trpc.eve.list.pathKey() });
    router.refresh();
  };
  const rename = useMutation(
    trpc.eve.rename.mutationOptions({
      onError: (error) => toast.error(error.message),
      onSuccess: refresh,
    })
  );
  const pin = useMutation(
    trpc.eve.pin.mutationOptions({
      onError: (error) => toast.error(error.message),
      onSuccess: refresh,
    })
  );
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
        {filtered.map((item) => {
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
      {!(filtered.length || history.isPending || history.isError) && (
        <p className="text-muted-foreground p-2 text-sm">
          {query
            ? "No matching conversations."
            : "Your conversations will appear here."}
        </p>
      )}
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
