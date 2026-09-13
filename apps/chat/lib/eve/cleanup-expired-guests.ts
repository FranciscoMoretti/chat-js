import { isUnacceptedEveCopy } from "../db/eve-copy-journal";
import { claimExpiredEveGuestFamilies } from "../db/eve-guest-cleanup";
import { deleteLocalEveConversationFamily } from "./delete-local-conversation";
import { deleteUnacceptedEveCopy } from "./delete-unaccepted-copy";
import { localDeletionAvailable } from "./local-deletion-available";

/** appRoot is the trusted worker directory. Guest and billing identities are retained. */
export async function cleanupExpiredEveGuests(appRoot: string) {
  if (!localDeletionAvailable()) {
    return { skipped: true, deletedCount: 0, pendingCount: 0 };
  }
  let deletedCount = 0;
  let pendingCount = 0;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const [family] = await claimExpiredEveGuestFamilies();
    if (!family) {
      break;
    }
    try {
      if (await isUnacceptedEveCopy(family.ownerId, family.id)) {
        await deleteUnacceptedEveCopy(family.ownerId, family.id);
      } else if (
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
        ownerId: family.ownerId,
        conversationId: family.id,
      });
    }
  }
  return { skipped: false, deletedCount, pendingCount };
}
