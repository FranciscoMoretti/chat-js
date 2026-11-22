import type { ChatPlugin } from "@/chatjs/core/installation/plugin";
import { followupSuggestionsRouter } from "./router";

export default function followupSuggestions() {
  return {
    id: "followup-suggestions",
    routers: { followupSuggestions: followupSuggestionsRouter },
  } satisfies ChatPlugin;
}
