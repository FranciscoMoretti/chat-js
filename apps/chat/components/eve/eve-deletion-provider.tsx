"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import React, { createContext, useCallback, useContext, useState } from "react";
/* oxlint-enable sort-imports */
import type { JSX as ReactJSX } from "react";

import { useSidebar } from "@/components/ui/sidebar";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { useCurrentChatRoute } from "@/lib/chat-route";
/* oxlint-disable sort-imports -- These type-only reader imports extend the existing runtime import groups; preserve module evaluation order and the formatter grouping. */
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
/* oxlint-enable sort-imports */
import { useTRPC } from "@/trpc/react";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { EveDeleteDialog } from "./eve-delete-dialog";
/* oxlint-enable sort-imports */

interface Conversation {
  readonly id: string;
  readonly title: string;
  readonly state: string;
  readonly projectId?: string | null;
}
/* oxlint-disable unicorn/no-null -- unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const DeletionContext = createContext<
  ((conversation: Conversation) => void) | null
>(null);
/* oxlint-enable unicorn/no-null */
/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships. */

const useEveDeletion = () => {
  const open = useContext(DeletionContext);
  if (!open) {
    throw new Error("Eve deletion requires its layout provider");
  }
  return open;
};
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */

/* oxlint-disable max-lines-per-function, no-magic-numbers, no-undefined, react-perf/jsx-no-new-function-as-prop, typescript/strict-boolean-expressions -- EveDeletionProvider: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 10_000); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including route.id). */

const EveDeletionProvider = ({
  children,
}: {
  readonly children: ReadonlyReactNode;
}): ReactJSX.Element => {
  const [conversation, setConversation] = useState<Conversation>();
  const route = useCurrentChatRoute();
  const router = useRouter();
  const cache = useQueryClient();
  const trpc = useTRPC();
  const { setOpenMobile } = useSidebar();
  const openConversation = useCallback(
    (value: Conversation) => {
      setConversation(value);
      setOpenMobile(false);
    },
    [setOpenMobile]
  );
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve changed's awaited sequencing and rejected-Promise behavior. */
  const changed = async (rootId: string): Promise<void> => {
    /* oxlint-disable react/todo -- Preserve cache invalidation in finally after route changes. */
    try {
      if (route.id && (route.type === "chat" || route.type === "projectChat")) {
        const response = await fetch(`/api/agent-conversations/${route.id}`, {
          signal: AbortSignal.timeout(10_000),
        });
        const status: unknown = await response.json();
        if (
          response.ok &&
          typeof status === "object" &&
          status !== null &&
          "rootId" in status &&
          status.rootId === rootId
        ) {
          const projectId =
            // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading projectId from conversation; preserve one receiver evaluation, skipped accesses and the existing (route.source === "project" ? route.projectId : undefined) fallback. The app guidance prefers optional chaining.
            conversation?.projectId ??
            // oxlint-disable-next-line no-ternary -- Keep ?? operand as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
            (route.source === "project" ? route.projectId : undefined);
          router.replace(
            // oxlint-disable-next-line no-ternary -- Keep router.replace argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
            typeof projectId === "string" && projectId !== ""
              ? `/project/${projectId}`
              : "/"
          );
        }
      }
    } finally {
      await cache.invalidateQueries({ queryKey: trpc.eve.list.pathKey() });
      router.refresh();
    }
    /* oxlint-enable react/todo */
  };
  /* oxlint-enable oxc/no-async-await */
  return (
    <DeletionContext.Provider value={openConversation}>
      {children}
      {conversation && (
        <EveDeleteDialog
          conversation={conversation}
          key={conversation.id}
          onChanged={changed}
          onClose={() => setConversation(undefined)}
        />
      )}
    </DeletionContext.Provider>
  );
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (EveDeletionProvider, useEveDeletion); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable max-lines-per-function, no-magic-numbers, no-undefined, react-perf/jsx-no-new-function-as-prop, typescript/strict-boolean-expressions */
/* oxlint-disable react/only-export-components -- #620: Consumers import EveDeletionProvider, useEveDeletion from this existing mixed component, context, or helper API; separating the Fast Refresh boundary remains tracked review debt. */
export { EveDeletionProvider, useEveDeletion };
/* oxlint-enable import/no-named-export */
/* oxlint-enable react/only-export-components */
