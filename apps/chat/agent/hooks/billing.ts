import { defineHook } from "eve/hooks";

import { ingestEveUsage } from "../../lib/eve/usage";

export default defineHook({
  events: {
    "*": async (event, context) => {
      const ownerId = context.session.auth.initiator?.principalId;
      if (!ownerId) {
        throw new Error("Eve billing requires an authenticated owner.");
      }
      await ingestEveUsage(ownerId, context.session.id, event);
    },
  },
});
