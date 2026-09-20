"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEveAgent } from "eve/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useState,
  useMemo,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";

import { ChatHeaderView } from "@/components/chat-header-view";
import { eveDocumentOperations } from "@/lib/eve/document-contracts";
import { LogicalChat } from "@/lib/eve/logical-chat";
import { eveMessageTitle } from "@/lib/eve/message-input";
import { useSession } from "@/providers/session-provider";
import { useTRPC } from "@/trpc/react";

import { EveConversation } from "./eve-conversation";
import { EveInitialMessage } from "./eve-initial-message";
import {
  EveLogicalContext,
  EveRuntimeContext,
  useEveRuntime,
} from "./eve-logical-context";
import type { OpenRequest } from "./eve-logical-context";
import { EveShareButton } from "./eve-share-dialog";

type Runtime = OpenRequest & { chatId: string; controller: LogicalChat };

const NativeObserver = ({
  controller,
  conversationId,
  sessionId,
}: {
  controller: LogicalChat;
  conversationId: string;
  sessionId: string;
}) => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const agent = useEveAgent({
    host: "/api",
    initialSession: { sessionId, streamIndex: 0 },
    onEvent: (event) => {
      if (event.type === "turn.completed") {
        void queryClient.invalidateQueries({
          queryKey: trpc.eve.list.pathKey(),
        });
      }
      if (
        event.type === "action.result" &&
        event.data.result.kind === "tool-result" &&
        Object.hasOwn(eveDocumentOperations, event.data.result.toolName)
      ) {
        void queryClient.invalidateQueries({
          queryKey: trpc.eve.document.pathKey(),
        });
      }
    },
    resume: true,
  });
  useEffect(() => {
    controller.observe(conversationId, agent);
  }, [agent, controller, conversationId]);
  return null;
};

const RuntimeSlot = ({
  runtime,
  active,
}: {
  runtime: Runtime;
  active: boolean;
}) => {
  const trpc = useTRPC();
  const { data: session } = useSession();
  const identity = useQuery(trpc.eve.get.queryOptions({ id: runtime.chatId }));
  const family = useQuery(
    trpc.eve.branches.queryOptions({ id: runtime.chatId })
  );
  const snapshot = useSyncExternalStore(
    runtime.controller.subscribe,
    runtime.controller.getSnapshot,
    runtime.controller.getSnapshot
  );
  useEffect(() => {
    if (family.data) {
      runtime.controller.setBranches(family.data.branches);
    }
  }, [family.data, runtime.controller]);
  useEffect(() => {
    runtime.controller.setVisible(active);
  }, [active, runtime.controller]);
  const context = useMemo(
    () => ({
      controller: runtime.controller,
      ownerId: runtime.ownerId,
      snapshot,
    }),
    [runtime.controller, runtime.ownerId, snapshot]
  );
  const selected = snapshot.branches.find(
    (branch) => branch.id === snapshot.conversationId
  );
  const agent = snapshot.agents.get(snapshot.conversationId);
  const header = (
    <ChatHeaderView
      actions={
        <>
          {session?.user && <EveShareButton chatId={snapshot.conversationId} />}
          <Link className="text-sm" href="/">
            New conversation
          </Link>
        </>
      }
      breadcrumb={
        <h1 className="ml-2 truncate text-sm font-medium">
          {identity.data?.title ??
            runtime.title ??
            (runtime.operation
              ? eveMessageTitle(runtime.operation.message)
              : "Chat")}
        </h1>
      }
    />
  );
  return (
    <>
      {snapshot.branches.map(
        (branch) =>
          branch.sessionId && (
            <NativeObserver
              key={branch.sessionId}
              controller={runtime.controller}
              conversationId={branch.id}
              sessionId={branch.sessionId}
            />
          )
      )}
      {active && (
        <EveLogicalContext.Provider value={context}>
          {agent && selected?.sessionId ? (
            <EveConversation
              conversationId={selected.id}
              sessionId={selected.sessionId}
              ownerId={runtime.ownerId}
              draftScopeId={runtime.chatId}
              initialMessage={runtime.operation?.message}
              header={header}
            />
          ) : (
            <section className="flex h-full min-h-0 flex-col">
              {header}
              {runtime.operation && (
                <EveInitialMessage message={runtime.operation.message} />
              )}
              <output>
                {family.error?.message ?? "Restoring conversation…"}
              </output>
            </section>
          )}
        </EveLogicalContext.Provider>
      )}
    </>
  );
};

/** Mounted in the layout: routes select a view; sessions belong to logical chats. */
export const EveRuntimeProvider = ({
  children,
  ownerId,
}: {
  children: ReactNode;
  ownerId?: string;
}) => {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const [runtimes, setRuntimes] = useState<Runtime[]>([]);
  // The registry is a stable runtime owner, not render state.
  // oxlint-disable-next-line react/hook-use-state -- Controllers must retain identity for the owner lifetime.
  const [registry] = useState(() => new Map<string, Runtime>());
  const open = useCallback(
    async (request: OpenRequest, navigate = true) => {
      const identity = await queryClient.fetchQuery(
        trpc.eve.get.queryOptions({ id: request.id })
      );
      const family = await queryClient.fetchQuery({
        ...trpc.eve.branches.queryOptions({ id: identity.chatId }),
        staleTime: 0,
      });
      const existing = registry.get(identity.chatId);
      const controller =
        existing?.controller ??
        new LogicalChat(identity.chatId, request.id, !navigate);
      controller.setBranches(family.branches);
      if (existing && navigate) {
        controller.selectBranch(request.id);
      }
      const runtime = {
        ...existing,
        ...request,
        chatId: identity.chatId,
        controller,
        title: identity.title,
      };
      registry.set(identity.chatId, runtime);
      setRuntimes([...registry.values()]);
      if (navigate && window.location.pathname !== `/chat/${identity.chatId}`) {
        window.history.pushState(null, "", `/chat/${identity.chatId}`);
      } else if (window.location.pathname !== `/chat/${identity.chatId}`) {
        window.history.replaceState(null, "", `/chat/${identity.chatId}`);
      }
    },
    [queryClient, trpc, registry]
  );
  const active = runtimes.find(
    (runtime) =>
      runtime.ownerId === ownerId && pathname === `/chat/${runtime.chatId}`
  );
  useEffect(() => {
    // Owner changes discard every observer; route changes do not cancel execution.
    for (const [id, runtime] of registry) {
      if (runtime.ownerId !== ownerId) {
        registry.delete(id);
      }
    }
  }, [ownerId, registry]);
  return (
    <EveRuntimeContext.Provider value={open}>
      {runtimes
        .filter((runtime) => runtime.ownerId === ownerId)
        .map((runtime) => (
          <RuntimeSlot
            key={`${runtime.ownerId}:${runtime.chatId}`}
            runtime={runtime}
            active={runtime === active}
          />
        ))}
      {!active && children}
    </EveRuntimeContext.Provider>
  );
};

export const EveRuntimeRoute = ({
  id,
  sessionId,
  ownerId,
  chatId,
  title,
}: OpenRequest) => {
  const open = useEveRuntime();
  const [failure, setFailure] = useState<string>();
  useEffect(() => {
    // oxlint-disable-next-line promise/prefer-await-to-then, promise/prefer-await-to-callbacks -- An effect schedules asynchronous route registration.
    void open({ chatId, id, ownerId, sessionId, title }, false).catch((error) =>
      setFailure(String(error))
    );
  }, [open, id, sessionId, ownerId, chatId, title]);
  return <output>{failure ?? "Restoring conversation…"}</output>;
};
