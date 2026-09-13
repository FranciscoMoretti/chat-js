import { defineState } from "eve/context";
import { defineHook } from "eve/hooks";

import {
  type FollowupContext,
  followupContext,
} from "../../lib/eve/followup-context";
import { generateEveFollowupSuggestions } from "../../lib/eve/generate-followup-suggestions";

const context = defineState<FollowupContext>(
  "chatjs.followups.context",
  () => ({ user: "", assistant: "" })
);

export default defineHook({
  events: {
    "turn.started": (event) =>
      context.update((current) => followupContext(current, event)),
    "message.received": (event) =>
      context.update((current) => followupContext(current, event)),
    "message.completed": (event) =>
      context.update((current) => followupContext(current, event)),
    "turn.completed": () => generateEveFollowupSuggestions(context.get()),
  },
});
