import { and, eq, inArray, or, sql } from "drizzle-orm";

import { db } from "./client";
import { tombstoneEveResponseGroups } from "./eve-response-groups";
import {
  eveCodeSandbox,
  eveChat,
  eveChatProject,
  eveConversation,
  eveConversationCopy,
  eveConversationCopyFile,
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
  routeId: string
) => {
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${ownerId}`}, 0))`
    );
    const [identity] = await tx
      .select({ chatId: eveChat.id })
      .from(eveChat)
      .leftJoin(
        eveConversation,
        and(
          eq(eveConversation.chatId, eveChat.id),
          eq(eveConversation.ownerId, eveChat.ownerId),
          eq(eveConversation.id, routeId)
        )
      )
      .where(
        and(
          eq(eveChat.ownerId, ownerId),
          or(eq(eveChat.id, routeId), eq(eveConversation.id, routeId))
        )
      );
    if (!identity) {
      throw new Error("Conversation identity is unavailable.");
    }
    const condition = and(
      eq(eveConversation.ownerId, ownerId),
      eq(eveConversation.chatId, identity.chatId)
    );
    const family = await tx.select().from(eveConversation).where(condition);
    if (
      !family.length ||
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
      .delete(eveChatProject)
      .where(eq(eveChatProject.chatId, identity.chatId));
    await tx.delete(eveVote).where(inArray(eveVote.conversationId, ids));
    await tx
      .update(eveConversation)
      .set({
        firstMessage: "",
        initialContentHash: null,
        initialModelId: null,
        initialProjectId: null,
        state: "deleted",
        visibility: "private",
      })
      .where(condition);
    await tx
      .update(eveChat)
      .set({
        activeConversationId: null,
        isPinned: false,
        title: "",
        titleStatus: "fallback",
      })
      .where(
        and(eq(eveChat.id, identity.chatId), eq(eveChat.ownerId, ownerId))
      );
  });
};

/** Includes identity tombstones so owners can retry and inspect completed deletion. */
export const getEveDeletionState = async (
  ownerId: string,
  conversationId: string
) => {
  const [row] = await db
    .select({
      chatId: eveChat.id,
      state: eveConversation.state,
    })
    .from(eveChat)
    .leftJoin(
      eveConversation,
      and(
        eq(eveConversation.chatId, eveChat.id),
        eq(eveConversation.ownerId, eveChat.ownerId),
        eq(eveConversation.id, conversationId)
      )
    )
    .where(
      and(
        eq(eveChat.ownerId, ownerId),
        or(
          eq(eveChat.id, conversationId),
          eq(eveConversation.id, conversationId)
        )
      )
    )
    .limit(1);
  if (!row) {
    return;
  }
  if (row.state) {
    return { rootId: row.chatId, state: row.state };
  }
  const [member] = await db
    .select({ state: eveConversation.state })
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.chatId, row.chatId),
        eq(eveConversation.ownerId, ownerId)
      )
    )
    .limit(1);
  return member ? { rootId: row.chatId, state: member.state } : undefined;
};
