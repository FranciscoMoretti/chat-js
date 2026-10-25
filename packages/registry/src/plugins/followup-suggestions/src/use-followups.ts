"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/react";
import type { ChatSuggestionsProps } from "@/lib/chat-plugin-contracts";
import { followupCompletion } from "./followup-completion";
import { config } from "@/lib/config";

const EMPTY_SUGGESTIONS: readonly string[] = [];
const POLL_INTERVAL_MS = 1000;
const MAX_POLLS = 20;

export const useEveFollowups = (
  conversationId: string,
  events: Parameters<typeof followupCompletion>[0],
  message: ChatSuggestionsProps["lastMessage"]
): readonly string[] => {
  const trpc = useTRPC();
  const eventId =
    message?.role === "assistant"
      ? followupCompletion(events, message.metadata?.turnId)
      : undefined;
  const query = useQuery({
    ...trpc.followupSuggestions.get.queryOptions({
      conversationId,
      eventId: eventId ?? "",
    }),
    enabled:
      config.ai.tools.followupSuggestions.enabled && eventId !== undefined,
    retry: false,
    refetchInterval: (current) =>
      current.state.status !== "error" &&
      current.state.data === null &&
      current.state.dataUpdateCount < MAX_POLLS
        ? POLL_INTERVAL_MS
        : false,
  });
  return !config.ai.tools.followupSuggestions.enabled || eventId === undefined
    ? EMPTY_SUGGESTIONS
    : (query.data ?? EMPTY_SUGGESTIONS);
};
