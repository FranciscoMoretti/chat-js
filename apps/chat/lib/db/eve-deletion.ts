import { and, eq, inArray, or, sql } from "drizzle-orm";

import { db } from "./client";
import { tombstoneEveResponseGroups } from "./eve-response-groups";
import {
  eveCodeSandbox,
  eveConversation,
  eveConversationCopy,
  eveConversationCopyFile,
  eveConversationProject,
  eveDocumentCheckpoint,
  eveDocumentCheckpointEntry,
  eveDocumentHead,
  eveDocumentRevision,
  eveFileReference,
  eveImportedDocumentCheckpoint,
  eveImportedDocumentCheckpointEntry,
  eveNamedDocumentCheckpoint,
  eveNamedDocumentCheckpointEntry,
  eveVote,
} from "./schema";

/**
 * Final application stage. The internal coordinator must confirm native payload,
 * sandbox and file removal before calling this; this is not a deletion endpoint.
 * Keep identity tombstones for replay protection and leave accounting intact.
 */
export const completeEveConversationDeletion = async (
  ownerId: string,
  rootId: string
) => {
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
    await tombstoneEveResponseGroups(tx, ownerId, family);
    const ids = family.map((row) => row.id);
    const [sandbox] = await tx
      .select({ name: eveCodeSandbox.name })
      .from(eveCodeSandbox)
      .where(
        and(
          inArray(eveCodeSandbox.conversationId, ids),
          eq(eveCodeSandbox.state, "unresolved")
        )
      )
      .limit(1);
    if (sandbox) {
      throw new Error("Code sandbox cleanup is incomplete.");
    }
    for (const table of [
      eveFileReference,
      eveImportedDocumentCheckpointEntry,
      eveImportedDocumentCheckpoint,
      eveNamedDocumentCheckpointEntry,
      eveNamedDocumentCheckpoint,
      eveDocumentCheckpointEntry,
      eveDocumentCheckpoint,
      eveDocumentHead,
      eveDocumentRevision,
    ]) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Process one resource at a time so fencing and cleanup stay ordered and bounded.
      const [remaining] = await tx
        .select({ conversationId: table.conversationId })
        .from(table)
        .where(inArray(table.conversationId, ids))
        .limit(1);
      if (remaining) {
        throw new Error("Application content cleanup is incomplete.");
      }
    }
    // Transcript preparation and provenance must not survive a completed family deletion.
    await tx
      .delete(eveConversationCopyFile)
      .where(inArray(eveConversationCopyFile.conversationId, ids));
    await tx
      .delete(eveConversationCopy)
      .where(inArray(eveConversationCopy.conversationId, ids));
    await tx
      .delete(eveConversationProject)
      .where(inArray(eveConversationProject.conversationId, ids));
    await tx.delete(eveVote).where(inArray(eveVote.conversationId, ids));
    await tx
      .update(eveConversation)
      .set({
        firstMessage: "",
        initialContentHash: null,
        initialModelId: null,
        initialProjectId: null,
        isPinned: false,
        state: "deleted",
        title: null,
        visibility: "private",
      })
      .where(condition);
  });
};

/** Includes identity tombstones so owners can retry and inspect completed deletion. */
export const getEveDeletionState = async (
  ownerId: string,
  conversationId: string
) => {
  const [row] = await db
    .select({
      id: eveConversation.id,
      rootId: eveConversation.rootConversationId,
      state: eveConversation.state,
    })
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.ownerId, ownerId),
        eq(eveConversation.id, conversationId)
      )
    )
    .limit(1);
  return row ? { rootId: row.rootId ?? row.id, state: row.state } : undefined;
};
