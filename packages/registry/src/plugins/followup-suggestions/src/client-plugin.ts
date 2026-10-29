"use client";
import { definePlugin, slot } from "@/lib/ui-slots";
import { ChatSuggestions } from "@/components/chat-slots";
import { FollowupSuggestions } from "./suggestions";

export const followupSuggestionsClient = definePlugin({
  id: "followup-suggestions",
  slots: [slot(ChatSuggestions, FollowupSuggestions)],
});
