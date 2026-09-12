"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createContext, type ReactNode, useContext, useState } from "react";
import { useSidebar } from "@/components/ui/sidebar";
import { useCurrentChatRoute } from "@/lib/chat-route";
import { useTRPC } from "@/trpc/react";
import { EveDeleteDialog } from "./eve-delete-dialog";

type Conversation = { id: string; title: string; state: string };
const DeletionContext = createContext<
  ((conversation: Conversation) => void) | null
>(null);

export function useEveDeletion() {
  const open = useContext(DeletionContext);
  if (!open) {
    throw new Error("Eve deletion requires its layout provider");
  }
  return open;
}

export function EveDeletionProvider({ children }: { children: ReactNode }) {
  const [conversation, setConversation] = useState<Conversation>();
  const route = useCurrentChatRoute();
  const router = useRouter();
  const cache = useQueryClient();
  const trpc = useTRPC();
  const { setOpenMobile } = useSidebar();
  async function changed(rootId: string) {
    try {
      if (route.id && (route.type === "chat" || route.type === "projectChat")) {
        const response = await fetch(`/api/agent-conversations/${route.id}`, {
          signal: AbortSignal.timeout(10_000),
        });
        const status = await response.json();
        if (response.ok && status.rootId === rootId) {
          router.replace(
            route.source === "project" && route.projectId
              ? `/project/${route.projectId}`
              : "/"
          );
        }
      }
    } finally {
      await cache.invalidateQueries({ queryKey: trpc.eve.list.pathKey() });
      router.refresh();
    }
  }
  return (
    <DeletionContext.Provider
      value={(value) => {
        setConversation(value);
        setOpenMobile(false);
      }}
    >
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
}
