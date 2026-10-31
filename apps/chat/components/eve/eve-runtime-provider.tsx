"use client";

import { hasText } from "@/components/text-value";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { MessageStreamEvent } from "eve/client";
import { useEveAgent } from "eve/react";
import { usePathname } from "next/navigation";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { JSX as ReactJSX } from "react";

import { Spinner } from "@/components/ui/spinner";
import { documentDefinitions } from "@/integrations/documents/definitions";
import { LogicalChat } from "@/lib/eve/logical-chat";
import { eveMessageTitle } from "@/lib/eve/message-input";
import { projectEveMessageDisplay } from "@/lib/eve/message-display";
import { hasPendingCreation } from "@/lib/eve/pending-create";
import { pendingEveMetadataMutations } from "@/lib/eve/optimistic-metadata";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
import { installedToolNames } from "@/integrations/tools/catalog";
import { useTRPC } from "@/trpc/react";

import { EveChatHeader } from "./eve-chat-header";
import { EveConversation } from "./eve-conversation";
import { EveInitialMessage } from "./eve-initial-message";
import {
  EveLogicalContext,
  EveRuntimeContext,
  useEveRuntime,
} from "./eve-logical-context";
import type { OpenRequest } from "./eve-logical-context";

type Runtime = OpenRequest & { chatId: string; controller: LogicalChat };

const NativeObserver = ({
  controller,
  conversationId,
  sessionId,
  selected,
}: {
  readonly controller: LogicalChat;
  readonly conversationId: string;
  readonly sessionId: string;
  readonly selected: boolean;
}): null => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const display = useQuery(trpc.eve.messageDisplay.queryOptions({ sessionId }));
  const agent = useEveAgent({
    host: "/api",
    // Every branch has an observer. Release idle HTTP connections so completed
    // histories cannot starve creation/navigation requests; send/resume reconnect.
    followIdle: false,
    initialSession: { sessionId, streamIndex: 0 },
    onEvent: (
      event:
        | {
            readonly type: Exclude<MessageStreamEvent["type"], "action.result">;
          }
        | {
            readonly type: "action.result";
            readonly data: {
              readonly result:
                | { readonly kind: "tool-result"; readonly toolName: string }
                | {
                    readonly kind: Exclude<
                      Extract<
                        MessageStreamEvent,
                        { type: "action.result" }
                      >["data"]["result"]["kind"],
                      "tool-result"
                    >;
                  };
            };
          }
    ) => {
      if (
        event.type === "turn.completed" ||
        event.type === "turn.failed" ||
        event.type === "turn.cancelled"
      ) {
        void queryClient.invalidateQueries({
          predicate: (query) => query.meta?.refreshOnTurnEnd === true,
        });
      }
      if (
        event.type === "turn.completed" &&
        pendingEveMetadataMutations(queryClient) === 0
      ) {
        void queryClient.invalidateQueries({
          queryKey: trpc.eve.get.pathKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.eve.list.pathKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.eve.messageDisplay.queryKey({ sessionId }),
        });
      }
      if (
        event.type === "action.result" &&
        event.data.result.kind === "tool-result" &&
        (documentDefinitions.operations.has(event.data.result.toolName) ||
          (installedToolNames.has("deleteDocument") &&
            event.data.result.toolName === "deleteDocument"))
      ) {
        void queryClient.invalidateQueries({
          queryKey: trpc.eve.document.pathKey(),
        });
      }
    },
    resume: true,
  });
  const { resume, status } = agent;
  useEffect(() => {
    const refreshSelected = async (): Promise<void> => {
      if (
        !selected ||
        status !== "ready" ||
        document.visibilityState !== "visible"
      ) {
        return;
      }
      try {
        await resume();
      } catch {
        // The native agent exposes the error in its snapshot for the UI.
      }
    };
    const refresh = (): void => {
      void refreshSelected();
    };
    // Refresh only the visible selected branch; do not retain idle streams.
    const interval = globalThis.setInterval(refresh, 10_000);
    globalThis.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      globalThis.clearInterval(interval);
      globalThis.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [selected, status, resume]);
  // The native hook returns a fresh wrapper on render. Project only when its
  // contents change, otherwise observe() publishes a new snapshot indefinitely.
  const displayedData = useMemo(
    () =>
      projectEveMessageDisplay(agent.data, agent.events, display.data ?? []),
    [agent.data, agent.events, display.data]
  );
  useEffect(() => {
    controller.observe(conversationId, { ...agent, data: displayedData });
  }, [agent, displayedData, controller, conversationId]);
  return null;
};

const RuntimeSlot = ({
  runtime,
  active,
}: {
  readonly runtime: Runtime;
  readonly active: boolean;
}): ReactJSX.Element => {
  const trpc = useTRPC();
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
    (branch: { readonly id: string }) => branch.id === snapshot.conversationId
  );
  const agent = snapshot.agents.get(snapshot.conversationId);
  const header = (
    <EveChatHeader
      chatId={runtime.chatId}
      conversationId={snapshot.conversationId}
      fallbackTitle={
        identity.data?.title ??
        runtime.title ??
        (runtime.operation
          ? eveMessageTitle(runtime.operation.message)
          : "Chat")
      }
      hasMessages={snapshot.nodes.size > 0}
    />
  );
  return (
    <>
      {snapshot.branches.map(
        (branch: { readonly sessionId: string | null; readonly id: string }) =>
          hasText(branch.sessionId) && (
            <NativeObserver
              key={branch.sessionId}
              controller={runtime.controller}
              conversationId={branch.id}
              sessionId={branch.sessionId}
              selected={active && branch.id === snapshot.conversationId}
            />
          )
      )}
      {active && (
        <EveLogicalContext.Provider value={context}>
          {agent && hasText(selected?.sessionId) ? (
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
              {family.error ? (
                <p role="alert">{family.error.message}</p>
              ) : (
                <div className="flex flex-1 items-center justify-center">
                  <Spinner aria-label="Loading conversation" />
                </div>
              )}
            </section>
          )}
        </EveLogicalContext.Provider>
      )}
    </>
  );
};

/** Mounted in the layout: routes select a view; sessions belong to logical chats. */
const EveRuntimeProvider = ({
  children,
  ownerId,
}: {
  readonly children: ReadonlyReactNode;
  readonly ownerId?: string;
}): ReactJSX.Element => {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const [runtimes, setRuntimes] = useState<Runtime[]>([]);
  const registry = useRef(new Map<string, Runtime>());
  const open = useCallback(
    async (request: OpenRequest, navigate = true) => {
      // Query resolves the requested chat identity before looking up its owning runtime.
      const identity = await queryClient.query(
        trpc.eve.get.queryOptions({ id: request.id })
      );

      // Query with staleTime 0 reloads the branch family before selecting or creating a runtime.
      const family = await queryClient.query({
        ...trpc.eve.branches.queryOptions({ id: identity.chatId }),
        staleTime: 0,
      });
      const existing = registry.current.get(identity.chatId);
      // Keep unresolved requests visible on their source after a reload, even
      // when the server already created a newer branch before the response was lost.
      const pendingSource = navigate
        ? undefined
        : family.branches
            .toSorted(
              (left, right) =>
                Number(right.id === request.id) - Number(left.id === request.id)
            )
            .find((branch) =>
              hasPendingCreation(sessionStorage, request.ownerId, {
                conversationId: branch.id,
              })
            );
      const controller =
        existing?.controller ??
        new LogicalChat(
          identity.chatId,
          pendingSource?.id ?? request.id,
          !navigate && !pendingSource
        );
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
      registry.current.set(identity.chatId, runtime);
      setRuntimes([...registry.current.values()]);
      if (
        navigate &&
        globalThis.location.pathname !== `/chat/${identity.chatId}`
      ) {
        globalThis.history.pushState(null, "", `/chat/${identity.chatId}`);
      } else if (globalThis.location.pathname !== `/chat/${identity.chatId}`) {
        globalThis.history.replaceState(null, "", `/chat/${identity.chatId}`);
      }
    },
    [queryClient, trpc, registry]
  );
  const active = runtimes.find(
    (runtime: Readonly<Pick<Runtime, "ownerId" | "chatId">>) =>
      runtime.ownerId === ownerId && pathname === `/chat/${runtime.chatId}`
  );
  useEffect(() => {
    // Owner changes discard every observer; route changes do not cancel execution.
    for (const [id, runtime] of registry.current) {
      if (runtime.ownerId !== ownerId) {
        registry.current.delete(id);
      }
    }
  }, [ownerId, registry]);
  return (
    <EveRuntimeContext.Provider value={open}>
      {runtimes
        .filter(
          (runtime: Readonly<Pick<Runtime, "ownerId">>) =>
            runtime.ownerId === ownerId
        )
        .map((runtime): React.JSX.Element => (
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

const EveRuntimeRoute = ({
  id,
  sessionId,
  ownerId,
  chatId,
  title,
}: OpenRequest): ReactJSX.Element => {
  const open = useEveRuntime();
  const [failure, setFailure] = useState<string>();
  useEffect(() => {
    const registerRoute = async (): Promise<void> => {
      try {
        await open({ chatId, id, ownerId, sessionId, title }, false);
      } catch (error: unknown) {
        setFailure(String(error));
      }
    };
    void registerRoute();
  }, [open, id, sessionId, ownerId, chatId, title]);
  if (typeof failure === "string" && failure !== "") {
    return <p role="alert">{failure}</p>;
  }
  return (
    <div className="flex h-full items-center justify-center">
      <Spinner aria-label="Loading conversation" />
    </div>
  );
};
export { EveRuntimeProvider, EveRuntimeRoute };
