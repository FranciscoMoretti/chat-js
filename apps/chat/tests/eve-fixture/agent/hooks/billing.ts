/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../../../lib/db/eve-billing" dependency within this package instead of introducing an alias or barrel API.
 */
import { defineHook } from "eve/hooks";

import { recordEveUsage } from "../../../../lib/db/eve-billing";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable import/no-default-export, oxc/no-async-await, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * import/no-default-export (#526): Preserve the existing default export import contract; converting its consumers requires a public module API migration.
 * oxc/no-async-await (#540): default export sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): default export handles optional context.session.auth.initiator?.principalId without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/prefer-readonly-parameter-types (#565): default export accepts event; context; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): default export intentionally keeps the existing falsy-value behavior of ownerId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
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
/* oxlint-enable import/no-default-export, oxc/no-async-await, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
