import type { ChatClientPlugin } from "@/lib/plugin-contracts";
import { FollowupSuggestions } from "./suggestions";

export const followupSuggestionsClient = () =>
  ({
    id: "followup-suggestions",
    chat: { Suggestions: FollowupSuggestions },
  }) satisfies ChatClientPlugin;
