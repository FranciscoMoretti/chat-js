import { defineHook } from "eve/hooks";

import { recordEveUsage } from "../../../../lib/db/eve-billing";

// This worker uses only the local mock model, whose provider cost is known to be zero.
export default defineHook({
  events: {
    "step.completed": async (event, context) => {
      const ownerId = context.session.auth.initiator?.principalId;
      if (!ownerId) {
        throw new Error("Missing fixture owner.");
      }
      await recordEveUsage({
        costUsd: 0,
        eventId: event.meta.id,
        ownerId,
        sessionId: context.session.id,
        turnId: event.data.turnId,
      });
    },
  },
});
