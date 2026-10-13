import { defineHook } from "eve/hooks";

import { ingestEveActivity } from "../../lib/eve/activity";

export default defineHook({
  events: {
    "*": async (
      event: Parameters<typeof ingestEveActivity>[2],
      context: {
        readonly session: {
          readonly auth: {
            readonly initiator: { readonly principalId: string } | null;
          };
          readonly id: string;
        };
      }
    ) => {
      const ownerId = context.session.auth.initiator?.principalId;
      if (typeof ownerId === "string" && ownerId !== "") {
        await ingestEveActivity(ownerId, context.session.id, event);
      }
    },
  },
});
