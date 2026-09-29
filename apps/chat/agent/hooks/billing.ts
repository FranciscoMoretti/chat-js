import { defineHook } from "eve/hooks";

import {
  getEveSubagent,
  registerEveSubagent,
} from "../../lib/db/eve-subagents";
import { ingestEveUsage } from "../../lib/eve/usage";

export default defineHook({
  events: {
    "*": async (event, context) => {
      const ownerId = context.session.auth.initiator?.principalId;
      if (!ownerId) {
        throw new Error("Eve billing requires an authenticated owner.");
      }
      const { parent } = context.session;
      if (!parent) {
        await ingestEveUsage(ownerId, context.session.id, event);
        return;
      }
      if (event.type === "session.started") {
        await registerEveSubagent(
          ownerId,
          parent.sessionId,
          context.session.id,
          parent.turn.id
        );
      }
      if (
        ![
          "step.completed",
          "step.failed",
          "compaction.usage",
          "hook.result",
          "action.result",
          "subagent.called",
        ].includes(event.type)
      ) {
        return;
      }
      const binding = await getEveSubagent(ownerId, context.session.id);
      if (!binding?.rootSessionId) {
        throw new Error("Child usage requires a native owner binding.");
      }
      await ingestEveUsage(ownerId, context.session.id, event, {
        sessionId: binding.rootSessionId,
        turnId: binding.rootTurnId,
      });
    },
  },
});
