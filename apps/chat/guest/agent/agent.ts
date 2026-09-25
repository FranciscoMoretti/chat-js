import { defineAgent, defineDynamic } from "eve";

import { GUEST_SESSION_DURATION_MS } from "../../lib/eve/disposable-guest";
import { resolveEveModel } from "../../lib/eve/model-selection";

export default defineAgent({
  defaultTools: false,
  // Vercel uses managed Workflow; local development uses its local World.
  experimental: { workflow: { retention: 0 } },
  limits: { sessionTimeoutMs: GUEST_SESSION_DURATION_MS },
  model: defineDynamic({
    events: {
      "step.started": (_event, context) => {
        const modelId = context.session.auth.initiator?.attributes.modelId;
        if (typeof modelId !== "string") {
          throw new TypeError("Guest session has no authorized model.");
        }
        return resolveEveModel(modelId);
      },
    },
  }),
});
