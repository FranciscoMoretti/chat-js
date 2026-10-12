import { isUnacceptedEveCopy } from "@/lib/db/eve-copy-journal";
import { claimExpiredEveGuestFamilies } from "@/lib/db/eve-guest-cleanup";
import { deleteLocalEveConversationFamily } from "./delete-local-conversation";
import { deleteUnacceptedEveCopy } from "./delete-unaccepted-copy";
import { localDeletionAvailable } from "./local-deletion-available";

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
    // oxlint-disable-next-line eslint/no-await-in-loop -- Claim one expired family and complete its unaccepted-copy or retired-family deletion before the next claim; the five-attempt budget and pending counters depend on that result.
    const [family] = await claimExpiredEveGuestFamilies();
    if (typeof family !== "object") {
      break;
    }
    try {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Claim one expired family and complete its unaccepted-copy or retired-family deletion before the next claim; the five-attempt budget and pending counters depend on that result.
      if (await isUnacceptedEveCopy(family.ownerId, family.id)) {
        // oxlint-disable-next-line eslint/no-await-in-loop -- Claim one expired family and complete its unaccepted-copy or retired-family deletion before the next claim; the five-attempt budget and pending counters depend on that result.
        await deleteUnacceptedEveCopy(family.ownerId, family.id);
      } else if (
        // oxlint-disable-next-line eslint/no-await-in-loop -- Claim one expired family and complete its unaccepted-copy or retired-family deletion before the next claim; the five-attempt budget and pending counters depend on that result.
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
