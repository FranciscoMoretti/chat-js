"use client";
import { definePlugin } from "@/lib/ui-slots";
import { ChatSuggestions } from "@/components/chat-slots";
import { FollowupSuggestions } from "./suggestions";

export const followupSuggestionsClient = definePlugin({
  id: "followup-suggestions",
  contributions: [ChatSuggestions.contribute(FollowupSuggestions)],
});
