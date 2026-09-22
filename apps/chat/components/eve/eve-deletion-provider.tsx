"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";

import { useSidebar } from "@/components/ui/sidebar";
import { useCurrentChatRoute } from "@/lib/chat-route";
import { useTRPC } from "@/trpc/react";

import { EveDeleteDialog } from "./eve-delete-dialog";

type Conversation = {
  id: string;
  title: string;
  state: string;
  projectId?: string | null;
};
const DeletionContext = createContext<
  ((conversation: Conversation) => void) | null
>(null);

export const useEveDeletion = () => {
  const open = useContext(DeletionContext);
  if (!open) {
    throw new Error("Eve deletion requires its layout provider");
  }
  return open;
};

export const EveDeletionProvider = ({ children }: { children: ReactNode }) => {
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
  const changed = async (rootId: string) => {
    /* oxlint-disable react/todo -- Preserve cache invalidation in finally after route changes. */
    try {
      if (route.id && (route.type === "chat" || route.type === "projectChat")) {
        const response = await fetch(`/api/agent-conversations/${route.id}`, {
          signal: AbortSignal.timeout(10_000),
        });
        const status = await response.json();
        if (response.ok && status.rootId === rootId) {
          const projectId =
            conversation?.projectId ??
            (route.source === "project" ? route.projectId : undefined);
          router.replace(projectId ? `/project/${projectId}` : "/");
        }
      }
      // oxlint-disable-next-line react/todo -- React Compiler cannot analyze required cache cleanup in finally.
    } finally {
      await cache.invalidateQueries({ queryKey: trpc.eve.list.pathKey() });
      router.refresh();
    }
    /* oxlint-enable react/todo */
  };
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
