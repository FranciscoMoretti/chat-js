/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../lib/eve/activity" dependency within this package instead of introducing an alias or barrel API.
 */
import { defineHook } from "eve/hooks";

import { ingestEveActivity } from "../../lib/eve/activity";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable import/no-default-export, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * import/no-default-export (#526): Preserve the existing default export import contract; converting its consumers requires a public module API migration.
 * typescript/prefer-readonly-parameter-types (#565): default export accepts event; context; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): default export intentionally keeps the existing falsy-value behavior of ownerId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
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
/* oxlint-enable import/no-default-export, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
