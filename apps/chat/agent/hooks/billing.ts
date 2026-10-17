import {
  getEveSubagent,
  registerEveSubagent,
} from "../../lib/db/eve-subagents";
import type { HookContext } from "eve/hooks";
import { defineHook } from "eve/hooks";

import { observeEveModelAccounting } from "../../lib/eve/model-accounting";

import { ingestEveUsage } from "../../lib/eve/usage";

export default defineHook({
  events: {
    "*": async (
      event: Parameters<typeof ingestEveUsage>[2],
      context: Readonly<{
        session: Readonly<
          Pick<HookContext["session"], "id" | "auth" | "parent">
        >;
      }>
    ) => {
      observeEveModelAccounting(event, context.session);
      const ownerId = context.session.auth.initiator?.principalId;
      if (typeof ownerId !== "string" || ownerId === "") {
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
      if (!["action.result", "agent.started"].includes(event.type)) {
        return;
      }
      const binding = await getEveSubagent(ownerId, context.session.id);
      if (
        typeof binding?.rootSessionId !== "string" ||
        binding.rootSessionId === ""
      ) {
        throw new Error("Child usage requires a native owner binding.");
      }
      await ingestEveUsage(ownerId, context.session.id, event, {
        sessionId: binding.rootSessionId,
        turnId: binding.rootTurnId,
      });
    },
  },
});
