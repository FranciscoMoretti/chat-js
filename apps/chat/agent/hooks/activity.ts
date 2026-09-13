import { defineHook } from "eve/hooks";

import { ingestEveActivity } from "../../lib/eve/activity";

export default defineHook({
  events: {
    "*": async (event, context) => {
      const ownerId = context.session.auth.initiator?.principalId;
      if (ownerId) {
        await ingestEveActivity(ownerId, context.session.id, event);
      }
    },
  },
});
