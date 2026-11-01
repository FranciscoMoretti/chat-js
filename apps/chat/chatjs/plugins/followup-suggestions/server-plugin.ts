import type { ChatPlugin } from "@/chatjs/core/installation/plugin";
import { followupSuggestionsRouter } from "./router";

export const followupSuggestions = () =>
  ({
    id: "followup-suggestions",
    routers: { followupSuggestions: followupSuggestionsRouter },
  }) satisfies ChatPlugin;
