"use client";

import type { Route } from "next";
import { useCallback } from "react";
import { toast } from "sonner";
import type { ChatMessage } from "@/lib/ai/types";
import { useCurrentChatRoute } from "@/lib/chat-route";
import type { ParallelRequestSpec } from "@/lib/draft-chat-submission";
import { runParallelThreadRequestSpecs } from "@/lib/parallel-chat-requests";
import {
  discardUnacknowledgedProvisionalChatConfirmation,
  registerProvisionalChatConfirmation,
} from "@/lib/provisional-chat-confirmations";
import { useCustomChatStoreApi } from "@/lib/stores/custom-store-provider";
import { useModelChange } from "@/providers/default-model-provider";
import { useSession } from "@/providers/session-provider";

function getProvisionalChatHref({
  chatId,
  projectId,
  source,
}: {
  chatId: string;
  projectId: string | null;
  source: "home" | "project";
}) {
  if (source === "project") {
    return projectId ? (`/project/${projectId}/chat/${chatId}` as Route) : null;
  }

  return `/chat/${chatId}` as Route;
}

function isInitialRoute(
  route: ReturnType<typeof useCurrentChatRoute>
): route is Extract<
  ReturnType<typeof useCurrentChatRoute>,
  { type: "home" | "projectHome" }
> {
  return route.type === "home" || route.type === "projectHome";
}

export function useStartProvisionalChat(chatId: string) {
  const currentRoute = useCurrentChatRoute();
  const changeModel = useModelChange();
  const { data: session } = useSession();
  const storeApi = useCustomChatStoreApi<ChatMessage>();

  return useCallback(
    ({
      message,
      onStarted,
      requestSpecs,
    }: {
      message: ChatMessage;
      onStarted?: () => void;
      requestSpecs: ParallelRequestSpec[];
    }) => {
      if (!(session?.user && isInitialRoute(currentRoute))) {
        return false;
      }

      const href = getProvisionalChatHref({
        chatId,
        projectId: currentRoute.projectId,
        source: currentRoute.source,
      });

      if (!href) {
        return false;
      }

      const primaryRequest = requestSpecs[0] ?? null;
      const storeState = storeApi.getState();
      const startRun = storeState.startRun;

      if (!startRun) {
        return false;
      }

      storeState.setStatus("submitted");

      registerProvisionalChatConfirmation(chatId, {
        parallelGroupId: message.metadata.parallelGroupId ?? null,
        userMessageId: message.id,
      });

      if (primaryRequest) {
        changeModel(primaryRequest.modelId);
      }

      runParallelThreadRequestSpecs({
        chatId,
        isAuthenticated: true,
        message,
        onRunStarted: storeState.registerParallelRun,
        projectId: currentRoute.projectId,
        requestSpecs,
        startRun,
      })
        .finally(() => {
          discardUnacknowledgedProvisionalChatConfirmation(chatId, message.id);
        })
        .then((failedRequestSpecs) => {
          if (failedRequestSpecs.length > 0) {
            toast.error("Failed to complete all parallel responses");
          }
        })
        .catch(() => {
          toast.error("Failed to complete all parallel responses");
        });

      window.history.pushState(null, "", href);
      onStarted?.();

      return true;
    },
    [changeModel, chatId, currentRoute, session?.user, storeApi]
  );
}
