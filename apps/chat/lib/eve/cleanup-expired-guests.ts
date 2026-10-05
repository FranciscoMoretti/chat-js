import { isUnacceptedEveCopy } from "@/lib/db/eve-copy-journal";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { claimExpiredEveGuestFamilies } from "@/lib/db/eve-guest-cleanup";
/* oxlint-enable sort-imports */

import { deleteLocalEveConversationFamily } from "./delete-local-conversation";
import { deleteUnacceptedEveCopy } from "./delete-unaccepted-copy";
import { localDeletionAvailable } from "./local-deletion-available";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (cleanupExpiredEveGuests); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve cleanupExpiredEveGuests's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-statements, no-console, no-continue, no-magic-numbers, typescript/strict-boolean-expressions --
 * max-statements (#512): cleanupExpiredEveGuests keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-console (#514): cleanupExpiredEveGuests emits operational command/error diagnostics through console; selecting another logging transport requires a runtime-specific decision.
 * no-continue (#515): cleanupExpiredEveGuests skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 * no-magic-numbers (#517): cleanupExpiredEveGuests uses 5, 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/strict-boolean-expressions (#610): cleanupExpiredEveGuests intentionally keeps the existing falsy-value behavior of family; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** The appRoot is the trusted worker directory. Guest and billing identities are retained.
 * @param {string} appRoot Trusted local worker root used for supported family resource cleanup.
 * @returns {ReturnType<typeof cleanupExpiredEveGuests>} Deleted and pending attempt counts for the bounded cleanup batch. Unsupported runtimes skip without a pendingCount because no inventory was read; per-family uncertainty remains pending without aborting later attempts.
 */
export const cleanupExpiredEveGuests = async (
  appRoot: string
): Promise<
  { deletedCount: number; skipped: boolean } & (
    | { reason: string; pendingCount?: undefined }
    | { pendingCount: number; reason?: undefined }
  )
> => {
  if (!localDeletionAvailable()) {
    // Omit pendingCount: no inventory was read, so the backlog is unknown.
    return {
      deletedCount: 0,
      reason: "unsupported_runtime",
      skipped: true,
    };
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-statements, no-console, no-continue, no-magic-numbers, typescript/strict-boolean-expressions */
