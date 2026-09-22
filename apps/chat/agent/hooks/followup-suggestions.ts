import { defineState } from "eve/context";
import { defineHook } from "eve/hooks";

import { followupContext } from "../../lib/eve/followup-context";
import type { FollowupContext } from "../../lib/eve/followup-context";
import { generateEveFollowupSuggestions } from "../../lib/eve/generate-followup-suggestions";

const context = defineState<FollowupContext>(
  "chatjs.followups.context",
  () => ({ assistant: "", user: "" })
);

export default defineHook({
  events: {
    "message.completed": (event) =>
      context.update((current) => followupContext(current, event)),
    "message.received": (event) =>
      context.update((current) => followupContext(current, event)),
    "turn.completed": (_event, hookContext) =>
      // Suggestions are actions for the user-facing branch, not a background task.
      hookContext.session.parent
        ? undefined
        : generateEveFollowupSuggestions(context.get()),
    "turn.started": (event) =>
      context.update((current) => followupContext(current, event)),
  },
});
