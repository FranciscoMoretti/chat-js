/* oxlint-disable import/no-relative-parent-imports  --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../lib/db/eve-subagents"; "../../lib/eve/usage" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { defineHook } from "eve/hooks";

import {
  getEveSubagent,
  registerEveSubagent,
} from "../../lib/db/eve-subagents";
import { ingestEveUsage } from "../../lib/eve/usage";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable import/no-default-export, max-statements, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions  --
 * import/no-default-export (#526): Preserve the existing default export import contract; converting its consumers requires a public module API migration.
 * max-statements (#512): default export keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * oxc/no-async-await (#540): default export sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): default export handles optional context.session.auth.initiator?.principalId; binding?.rootSessionId without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/prefer-readonly-parameter-types (#565): default export accepts event; context; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): default export intentionally keeps the existing falsy-value behavior of ownerId; binding?.rootSessionId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
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
/* oxlint-enable import/no-default-export, max-statements, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
