import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "./client";
import {
  eveConversation,
  eveConversationProject,
  eveDocumentCheckpoint,
  eveDocumentCheckpointEntry,
  eveDocumentHead,
  eveDocumentRevision,
  eveFileReference,
  eveVote,
} from "./schema";

/**
 * Final application stage. The internal coordinator must confirm native payload,
 * sandbox and file removal before calling this; this is not a deletion endpoint.
 * Keep identity tombstones for replay protection and leave accounting intact.
 */
export async function completeEveConversationDeletion(
  ownerId: string,
  rootId: string
) {
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${ownerId}`}, 0))`
    );
    const condition = and(
      eq(eveConversation.ownerId, ownerId),
      or(
        eq(eveConversation.id, rootId),
        eq(eveConversation.rootConversationId, rootId)
      )
    );
    const family = await tx.select().from(eveConversation).where(condition);
    if (
      !family.some(
        (row) => row.id === rootId && row.rootConversationId === null
      ) ||
      family.some((row) => row.state !== "deleting" && row.state !== "deleted")
    ) {
      throw new Error(
        "The entire conversation family must be pending deletion."
      );
    }
    const ids = family.map((row) => row.id);
    for (const table of [
      eveFileReference,
      eveDocumentCheckpointEntry,
      eveDocumentCheckpoint,
      eveDocumentHead,
      eveDocumentRevision,
    ]) {
      const [remaining] = await tx
        .select({ conversationId: table.conversationId })
        .from(table)
        .where(inArray(table.conversationId, ids))
        .limit(1);
      if (remaining) {
        throw new Error("Application content cleanup is incomplete.");
      }
    }
    await tx
      .delete(eveConversationProject)
      .where(inArray(eveConversationProject.conversationId, ids));
    await tx.delete(eveVote).where(inArray(eveVote.conversationId, ids));
    await tx
      .update(eveConversation)
      .set({
        state: "deleted",
        firstMessage: "",
        title: null,
        initialModelId: null,
        initialContentHash: null,
        visibility: "private",
        isPinned: false,
      })
      .where(condition);
  });
}
