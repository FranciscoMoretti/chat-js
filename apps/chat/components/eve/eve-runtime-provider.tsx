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
import { eveDocumentOperations } from "@/lib/eve/document-contracts";
import { LogicalChat } from "@/lib/eve/logical-chat";
import { eveMessageTitle } from "@/lib/eve/message-input";
import { pendingEveMetadataMutations } from "@/lib/eve/optimistic-metadata";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
import { installedToolNames } from "@/tools/chatjs/installed-features";
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
}: {
  readonly controller: LogicalChat;
  readonly conversationId: string;
  readonly sessionId: string;
}): null => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const agent = useEveAgent({
    host: "/api",
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
        event.type === "turn.completed" &&
        pendingEveMetadataMutations(queryClient) === 0
      ) {
        void queryClient.invalidateQueries({
          queryKey: trpc.eve.get.pathKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.eve.list.pathKey(),
        });
      }
      if (
        event.type === "action.result" &&
        event.data.result.kind === "tool-result" &&
        (Object.hasOwn(eveDocumentOperations, event.data.result.toolName) ||
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
  useEffect(() => {
    controller.observe(conversationId, agent);
  }, [agent, controller, conversationId]);
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
