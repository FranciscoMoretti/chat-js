/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../lib/eve/activity" dependency within this package instead of introducing an alias or barrel API.
 */
import { defineHook } from "eve/hooks";

import { ingestEveActivity } from "../../lib/eve/activity";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this statement's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable import/no-default-export, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * import/no-default-export (#526): Preserve the existing default export import contract; converting its consumers requires a public module API migration.
 * typescript/prefer-readonly-parameter-types (#565): default export accepts event; context; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): default export intentionally keeps the existing falsy-value behavior of ownerId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
export default defineHook({
  events: {
    "*": async (event, context) => {
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading principalId from context.session.auth.initiator; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      const ownerId = context.session.auth.initiator?.principalId;
      if (ownerId) {
        await ingestEveActivity(ownerId, context.session.id, event);
      }
    },
  },
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable import/no-default-export, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
