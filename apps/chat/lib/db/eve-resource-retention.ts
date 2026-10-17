import { and, eq, inArray } from "drizzle-orm";
import { db } from "./client";
import { lockEveCopyOwners } from "./eve-copy-journal";
import { eveConversation, eveConversationCopy } from "./schema";

/**
 * Authorize checkpoint reclamation under the same owner lock as copy admission.
 * Accepted transcript copies retain their preparation until binding completes;
 * bound copies own their seed, documents and files independently. Native sandbox
 * borrowers are checked separately by the provider before snapshot removal.
 * @param {string} ownerId Authorized owner of the retired source.
 * @param {string} rootSessionId Exact deleting source binding (also for descendants).
 * @param {() => Promise<T>} reclaim Provider reclamation after application references are fenced.
 * @returns {Promise<T>} Provider result; pending copies or a non-retired source reject.
 */
export const withEveResourceReclamation = async <T>(
  ownerId: string,
  rootSessionId: string,
  reclaim: () => Promise<T>
): Promise<T> =>
  await db.transaction(async (tx) => {
    await lockEveCopyOwners(tx, [ownerId]);
    const sources = await tx
      .select({ id: eveConversation.id })
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.ownerId, ownerId),
          eq(eveConversation.sessionId, rootSessionId),
          eq(eveConversation.state, "deleting")
        )
      )
      .limit(1);
    const source = sources.at(0);
    if (source === undefined) {
      throw new Error("Retire the source before reclaiming its checkpoints.");
    }
    const pending = await tx
      .select({ id: eveConversationCopy.conversationId })
      .from(eveConversationCopy)
      .where(
        and(
          eq(eveConversationCopy.sourceOwnerId, ownerId),
          eq(eveConversationCopy.sourceConversationId, source.id),
          inArray(eveConversationCopy.phase, ["preparing", "accepted"])
        )
      )
      .limit(1);
    if (pending.length > 0) {
      throw new Error("A pending copy still retains the source checkpoint.");
    }
    return await reclaim();
  });
