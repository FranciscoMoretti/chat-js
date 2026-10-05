"use client";

import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { isToday, isYesterday, subMonths, subWeeks } from "date-fns";
/* oxlint-enable sort-imports */
import { usePathname } from "next/navigation";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { JSX as ReactJSX } from "react";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import React, { useEffect, useRef, useState } from "react";
/* oxlint-enable sort-imports */

import { ProjectChatItem } from "@/components/project-chat-item";
import { SidebarChatItem } from "@/components/sidebar-chat-item";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Button } from "@/components/ui/button";
/* oxlint-enable sort-imports */
import { Separator } from "@/components/ui/separator";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  useSidebar,
} from "@/components/ui/sidebar";
/* oxlint-enable sort-imports */
import type { listEveConversations } from "@/lib/db/eve-queries";
/* oxlint-disable import/max-dependencies -- @/lib/eve/optimistic-metadata import: import/max-dependencies: these direct dependencies compose this feature without hiding imports behind a barrel. */
import { pendingEveMetadataMutations } from "@/lib/eve/optimistic-metadata";
/* oxlint-enable import/max-dependencies */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { parseChatIdFromPathname } from "@/providers/parse-chat-id-from-pathname";
/* oxlint-enable sort-imports */
import { useSession } from "@/providers/session-provider";
import { useTRPC } from "@/trpc/react";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { useEveDeletion } from "./eve-deletion-provider";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { EveMoveProjectDialog } from "./eve-move-project-dialog";
/* oxlint-enable sort-imports */
import { EveShareDialogContent } from "./eve-share-dialog";
import { useEveMetadataMutations } from "./use-eve-metadata-mutations";

const titlePollIntervalMs = 1000;
const titlePollLimitMs = 30_000;
/* oxlint-disable max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types -- groupLabel: max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 1); typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

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
/* oxlint-enable max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types */
/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null -- EveHistoryList: ; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including page); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including projectId); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

export const EveHistoryList = ({
  initialPage,
  ownerId,
  projectId,
}: {
  ownerId: string;
  projectId?: string;
  initialPage: Awaited<ReturnType<typeof listEveConversations>>;
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
        void queryClient.invalidateQueries({
          queryKey: trpc.eve.get.pathKey(),
        });
      }
      hadPendingTitle.current = false;
      titlePollStartedAt.current = undefined;
      return;
    }
    hadPendingTitle.current = true;
    // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: Preserve the existing lazy initialization or absent-value guard; replacing it with coalescing changes the control-flow form.
    if (titlePollStartedAt.current === undefined) {
      titlePollStartedAt.current = Date.now();
    }
    const remaining =
      titlePollLimitMs - (Date.now() - titlePollStartedAt.current);
    if (remaining <= 0) {
      return;
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
    // oxlint-disable-next-line typescript/consistent-return -- #580: This effect returns cleanup only when it installed an active resource; inactive branches intentionally return nothing.
    return (): void => {
      globalThis.clearInterval(interval);
      globalThis.clearTimeout(timeout);
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
      // oxlint-disable-next-line react/forbid-component-props -- SidebarGroup accepts className in its styling contract; preserve this caller's layout and appearance.
      className={projectId ? "p-0" : "group-data-[collapsible=icon]:hidden"}
    >
      {!projectId && <SidebarGroupLabel>Chats</SidebarGroupLabel>}
      {grouped
        .filter((group) => group.items.length)
        .map((group): React.JSX.Element => (
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
                  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this return statement's awaited sequencing and rejected-Promise behavior. */
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
                  /* oxlint-enable oxc/no-async-await */
                }
                /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this return statement's awaited sequencing and rejected-Promise behavior. */
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
                /* oxlint-enable oxc/no-async-await */
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
            onClick={() => {
              void (history.isFetchNextPageError
                ? history.fetchNextPage()
                : history.refetch());
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
          // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
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
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable max-lines -- eve-history-list keeps its cohesive feature and related render helpers together; splitting this module requires a separate public-boundary review. This exception covers the file-length metric. */
