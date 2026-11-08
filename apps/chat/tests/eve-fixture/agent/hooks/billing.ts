import { defineHook } from "eve/hooks";

import { recordEveUsage } from "../../../../lib/db/eve-billing";

// This worker uses only the local mock model, whose provider cost is known to be zero.
export default defineHook({
  events: {
    "model.settled": async (
      event: {
        readonly data: { readonly runId: string };
      },
      context: {
        readonly session: {
          readonly id: string;
          readonly turn: { readonly id: string };
          readonly auth: {
            readonly initiator: { readonly principalId: string } | null;
          };
        };
      }
    ) => {
      const ownerId = context.session.auth.initiator?.principalId;
      if (ownerId === undefined || ownerId === null || ownerId === "") {
        throw new Error("Missing fixture owner.");
      }
      await recordEveUsage({
        costUsd: 0,
        eventId: `fixture-model:${event.data.runId}`,
        ownerId,
        sessionId: context.session.id,
        turnId: context.session.turn.id,
      });
    },
  },
});
