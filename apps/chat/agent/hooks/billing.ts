/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../lib/db/eve-subagents"; "../../lib/eve/usage" dependency within this package instead of introducing an alias or barrel API.
 */
import {
  getEveSubagent,
  registerEveSubagent,
} from "../../lib/db/eve-subagents";
import type { HookContext } from "eve/hooks";
import { defineHook } from "eve/hooks";

import { ingestEveUsage } from "../../lib/eve/usage";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this statement's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable import/no-default-export, max-statements -- import/no-default-export (#526): Preserve the existing default export import contract; converting its consumers requires a public module API migration.
max-statements (#512): default export keeps its ordered workflow and input contract together; context; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */

export default defineHook({
  events: {
    "*": async (
      // oxlint-disable-next-line no-magic-numbers -- Index two selects the existing ingestion event parameter in this type-only reader contract.
      event: Parameters<typeof ingestEveUsage>[2],
      context: Readonly<{
        session: Readonly<
          Pick<HookContext["session"], "id" | "auth" | "parent">
        >;
      }>
    ) => {
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading principalId from context.session.auth.initiator; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
      // oxlint-disable-next-line oxc/no-optional-chaining, typescript/strict-boolean-expressions -- Preserve the original nullable-binding truthiness guard and repeated getter reads; direct property narrowing keeps the second rootSessionId read assignable to the usage API.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable import/no-default-export, max-statements */
