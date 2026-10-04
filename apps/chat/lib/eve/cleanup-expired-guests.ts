import { isUnacceptedEveCopy } from "@/lib/db/eve-copy-journal";
import { claimExpiredEveGuestFamilies } from "@/lib/db/eve-guest-cleanup";

import { deleteLocalEveConversationFamily } from "./delete-local-conversation";
import { deleteUnacceptedEveCopy } from "./delete-unaccepted-copy";
import { localDeletionAvailable } from "./local-deletion-available";

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-statements, no-console, no-continue, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions --
 * jsdoc/require-param (#534): cleanupExpiredEveGuests's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): cleanupExpiredEveGuests's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-statements (#512): cleanupExpiredEveGuests keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-console (#514): cleanupExpiredEveGuests emits operational command/error diagnostics through console; selecting another logging transport requires a runtime-specific decision.
 * no-continue (#515): cleanupExpiredEveGuests skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 * no-magic-numbers (#517): cleanupExpiredEveGuests uses 5, 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/explicit-function-return-type (#560): Keep cleanupExpiredEveGuests's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep cleanupExpiredEveGuests's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/strict-boolean-expressions (#610): cleanupExpiredEveGuests intentionally keeps the existing falsy-value behavior of family; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** The appRoot is the trusted worker directory. Guest and billing identities are retained. */
export const cleanupExpiredEveGuests = async (appRoot: string) => {
  if (!localDeletionAvailable()) {
    return { deletedCount: 0, pendingCount: 0, skipped: true };
  }
  let deletedCount = 0;
  let pendingCount = 0;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Keep quota admission and cleanup ordered and bounded.
    const [family] = await claimExpiredEveGuestFamilies();
    if (!family) {
      break;
    }
    try {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Keep quota admission and cleanup ordered and bounded.
      if (await isUnacceptedEveCopy(family.ownerId, family.id)) {
        // oxlint-disable-next-line eslint/no-await-in-loop -- Keep quota admission and cleanup ordered and bounded.
        await deleteUnacceptedEveCopy(family.ownerId, family.id);
      } else if (
        // oxlint-disable-next-line eslint/no-await-in-loop -- Keep ordered reads and bounded cleanup sequential.
        !(await deleteLocalEveConversationFamily(
          family.ownerId,
          family.id,
          appRoot
        ))
      ) {
        pendingCount += 1;
        continue;
      }
      deletedCount += 1;
    } catch {
      // Keep uncertain bindings and pending fences. A failed family must not
      // prevent the rest of this batch, or later cron batches, from progressing.
      pendingCount += 1;
      console.error("Expired guest family cleanup remains pending", {
        conversationId: family.id,
        ownerId: family.ownerId,
      });
    }
  }
  return { deletedCount, pendingCount, skipped: false };
};
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-statements, no-console, no-continue, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions */
