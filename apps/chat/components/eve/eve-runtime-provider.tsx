"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEveAgent } from "eve/react";
import { usePathname } from "next/navigation";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
/* oxlint-enable sort-imports */
import type { JSX as ReactJSX, ReactNode } from "react";

import { Spinner } from "@/components/ui/spinner";
import { eveDocumentOperations } from "@/lib/eve/document-contracts";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { LogicalChat } from "@/lib/eve/logical-chat";
/* oxlint-enable sort-imports */
import { eveMessageTitle } from "@/lib/eve/message-input";
import { pendingEveMetadataMutations } from "@/lib/eve/optimistic-metadata";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { installedToolNames } from "@/tools/chatjs/installed-features";
/* oxlint-enable sort-imports */
/* oxlint-disable import/max-dependencies -- @/trpc/react import: import/max-dependencies: these direct dependencies compose this feature without hiding imports behind a barrel. */
import { useTRPC } from "@/trpc/react";
/* oxlint-enable import/max-dependencies */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { EveChatHeader } from "./eve-chat-header";
/* oxlint-enable sort-imports */
import { EveConversation } from "./eve-conversation";
import { EveInitialMessage } from "./eve-initial-message";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  EveLogicalContext,
  EveRuntimeContext,
  useEveRuntime,
} from "./eve-logical-context";
/* oxlint-enable sort-imports */
import type { OpenRequest } from "./eve-logical-context";

type Runtime = OpenRequest & { chatId: string; controller: LogicalChat };
/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/no-null -- NativeObserver: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including event); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const NativeObserver = ({
  controller,
  conversationId,
  sessionId,
}: {
  controller: LogicalChat;
  conversationId: string;
  sessionId: string;
}): null => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const agent = useEveAgent({
    host: "/api",
    initialSession: { sessionId, streamIndex: 0 },
    onEvent: (event) => {
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
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/no-null */
/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, react-perf/jsx-no-jsx-as-prop, react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- RuntimeSlot: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); react-perf/jsx-no-jsx-as-prop: this component composition slot accepts an element from the current render; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including branch); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including branch.sessionId). */

const RuntimeSlot = ({
  runtime,
  active,
}: {
  runtime: Runtime;
  active: boolean;
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
    (branch) => branch.id === snapshot.conversationId
  );
  const agent = snapshot.agents.get(snapshot.conversationId);
  const header = (
    <EveChatHeader
      chatId={runtime.chatId}
      conversationId={snapshot.conversationId}
      fallbackTitle={
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading title from identity.data; preserve one receiver evaluation, skipped accesses and the existing runtime.title fallback. The app guidance prefers optional chaining.
        identity.data?.title ??
        runtime.title ??
        // oxlint-disable-next-line no-ternary -- Keep ?? operand as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
          {
            // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
            agent /* oxlint-disable oxc/no-optional-chaining -- Keep the existing nullish guard when reading sessionId from selected; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining. */ &&
            selected?.sessionId ? (
              /* oxlint-enable oxc/no-optional-chaining */ <EveConversation
                conversationId={selected.id}
                sessionId={selected.sessionId}
                ownerId={runtime.ownerId}
                draftScopeId={runtime.chatId}
                initialMessage={
                  /* oxlint-disable oxc/no-optional-chaining -- Keep the existing nullish guard when reading message from runtime.operation; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining. */
                  runtime.operation?.message
                  /* oxlint-enable oxc/no-optional-chaining */
                }
                header={header}
              />
            ) : (
              <section className="flex h-full min-h-0 flex-col">
                {header}
                {runtime.operation && (
                  <EveInitialMessage message={runtime.operation.message} />
                )}
                {
                  // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
                  family.error ? (
                    <p role="alert">{family.error.message}</p>
                  ) : (
                    <div className="flex flex-1 items-center justify-center">
                      <Spinner aria-label="Loading conversation" />
                    </div>
                  )
                }
              </section>
            )
          }
        </EveLogicalContext.Provider>
      )}
    </>
  );
};
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, react-perf/jsx-no-jsx-as-prop, react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, react/no-multi-comp, typescript/prefer-readonly-parameter-types, unicorn/no-null -- EveRuntimeProvider: jsdoc/require-param: the TypeScript signature describes these parameters; the prose documents behavior rather than duplicate tags; jsdoc/require-returns: the inferred or annotated return type describes the value; the prose documents behavior rather than duplicate tags; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including request: OpenRequest); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

/** Mounted in the layout: routes select a view; sessions belong to logical chats. */
const EveRuntimeProvider = ({
  children,
  ownerId,
}: {
  children: ReactNode;
  ownerId?: string;
}): ReactJSX.Element => {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const [runtimes, setRuntimes] = useState<Runtime[]>([]);
  // The registry is a stable runtime owner, not render state.
  // oxlint-disable-next-line react/hook-use-state -- Controllers must retain identity for the owner lifetime.
  const [registry] = useState(() => new Map<string, Runtime>());
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve open's awaited sequencing and rejected-Promise behavior. */
  const open = useCallback(
    async (request: OpenRequest, navigate = true) => {
      // Query resolves the requested chat identity before looking up its owning runtime.
      const identity = await queryClient.query(
        trpc.eve.get.queryOptions({ id: request.id })
      );

      // Query with staleTime 0 reloads the branch family before selecting or creating a runtime.
      const family = await queryClient.query({
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing trpc.eve.branches.queryOptions({ id: identity.chatId }) own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...trpc.eve.branches.queryOptions({ id: identity.chatId }),
        staleTime: 0,
      });
      const existing = registry.get(identity.chatId);
      const controller =
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading controller from existing; preserve one receiver evaluation, skipped accesses and the existing new LogicalChat(identity.chatId, request.id, !navigate) fallback. The app guidance prefers optional chaining.
        existing?.controller ??
        new LogicalChat(identity.chatId, request.id, !navigate);
      controller.setBranches(family.branches);
      if (existing && navigate) {
        controller.selectBranch(request.id);
      }
      const runtime = {
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing existing own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...existing,
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing request own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...request,
        chatId: identity.chatId,
        controller,
        title: identity.title,
      };
      registry.set(identity.chatId, runtime);
      setRuntimes([...registry.values()]);
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
  /* oxlint-enable oxc/no-async-await */
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, react/no-multi-comp, typescript/prefer-readonly-parameter-types, unicorn/no-null */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- EveRuntimeRoute: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

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
    // oxlint-disable-next-line oxc/no-async-await -- Await registration so this effect can report rejection through its visible failure state.
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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (EveRuntimeProvider, EveRuntimeRoute); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */
export { EveRuntimeProvider, EveRuntimeRoute };
/* oxlint-enable import/no-named-export */
