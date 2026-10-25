"use client";
import { pluginRoute } from "@/lib/plugin-route";

import { withTaskCleanup } from "@/components/task-cleanup";

import { hasText } from "@/components/text-value";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import React, { createContext, useCallback, useContext, useState } from "react";
import type { JSX as ReactJSX } from "react";

import { useSidebar } from "@/components/ui/sidebar";
import { useCurrentChatRoute } from "@/lib/chat-route";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
import { useTRPC } from "@/trpc/react";

import { EveDeleteDialog } from "./eve-delete-dialog";

interface Conversation {
  readonly id: string;
  readonly title: string;
  readonly state: string;
  readonly scope?: "conversation" | "group";
  readonly parentHref?: string;
}

const DeletionContext = createContext<
  ((conversation: Conversation) => void) | null
>(null);

const useEveDeletion = () => {
  const open = useContext(DeletionContext);
  if (!open) {
    throw new Error("Eve deletion requires its layout provider");
  }
  return open;
};

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
  const changed = async (rootId: string): Promise<void> => {
    await withTaskCleanup(
      async () => {
        if (
          hasText(route.id) &&
          (route.type === "chat" || route.type === "pluginChat")
        ) {
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
            router.replace(
              pluginRoute(conversation?.parentHref ?? route.parentHref)
            );
          }
        }
      },
      async () => {
        await cache.invalidateQueries({ queryKey: trpc.eve.list.pathKey() });
        await cache.invalidateQueries({
          queryKey: trpc.eve.branches.pathKey(),
        });
        router.refresh();
      }
    );
  };
  return (
    <DeletionContext.Provider value={openConversation}>
      {children}
      {conversation && (
        <EveDeleteDialog
          conversation={conversation}
          key={conversation.id}
          onChanged={changed}
          onClose={() => {
            setConversation(undefined);
          }}
        />
      )}
    </DeletionContext.Provider>
  );
};

export { EveDeletionProvider, useEveDeletion };
