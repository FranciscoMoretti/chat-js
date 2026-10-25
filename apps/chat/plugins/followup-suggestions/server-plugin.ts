import type { ChatPlugin } from "@/lib/plugin-contracts";
import { followupSuggestionsRouter } from "./router";

export const followupSuggestions = () =>
  ({
    id: "followup-suggestions",
    routers: { followupSuggestions: followupSuggestionsRouter },
  }) satisfies ChatPlugin;
