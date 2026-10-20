import {
  eveWorkspace,
  eveWorkspaceAttachment,
  eveConversation,
  eveFileReference,
  eveStoredFile,
} from "./schema";
import { eveDeletionScope } from "./eve-deletion-scope";
import {
  and,
  eq,
  inArray,
  ne,
  notExists,
  notInArray,
  or,
  sql,
} from "drizzle-orm";

import { db } from "./client";

const EMPTY_RESULT_COUNT = 0;
const EXISTENCE_QUERY_LIMIT = 1;
const FIRST_ROW_INDEX = 0;

type FilePurgeReadTransaction = Readonly<Pick<typeof db, "select">>;
type FilePurgeWriteTransaction = Readonly<
  Pick<typeof db, "select" | "execute" | "update" | "delete">
>;

const deletingFamilyIds = async (
  tx: FilePurgeReadTransaction,
  ownerId: string,
  rootId: string
): Promise<string[]> => {
  const family = await tx
    .select({
      id: eveConversation.id,
      state: eveConversation.state,
    })
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.ownerId, ownerId),
        eveDeletionScope(ownerId, rootId)
      )
    );
  if (
    family.length === EMPTY_RESULT_COUNT ||
    family.some(
      (row: Readonly<{ state: string }>) =>
        row.state !== "deleting" && row.state !== "deleted"
    )
  ) {
    throw new Error("The entire conversation family must be pending deletion.");
  }
  return family.map((row: Readonly<{ id: string }>) => row.id);
};

/** Include originals retained only by a workspace whose final member is being removed. */
const purgeCandidate = (
  tx: FilePurgeReadTransaction,
  ids: readonly string[]
): ReturnType<typeof or> =>
  or(
    inArray(
      eveStoredFile.key,
      tx
        .select({ key: eveFileReference.key })
        .from(eveFileReference)
        .where(inArray(eveFileReference.conversationId, ids))
    ),
    inArray(
      eveStoredFile.key,
      tx
        .select({ key: eveWorkspaceAttachment.fileKey })
        .from(eveWorkspaceAttachment)
        .innerJoin(
          eveWorkspace,
          eq(eveWorkspace.id, eveWorkspaceAttachment.workspaceId)
        )
        .where(
          and(
            eq(eveWorkspace.state, "deleted"),
            inArray(
              eveWorkspace.id,
              tx
                .select({ id: eveConversation.workspaceId })
                .from(eveConversation)
                .where(inArray(eveConversation.id, ids))
            )
          )
        )
    )
  );

/**
 * Fence exclusively referenced files before external deletion; retain references for retries.
 * @param {string} ownerId Owner whose deleting conversation family authorizes the cleanup.
 * @param {string} rootId Shared family root; every family member must already be pending deletion.
 * @returns {Promise<string[]>} Sorted storage keys fenced for removal, excluding files still referenced outside the family.
 */
const prepareEveFamilyFilePurge = async (
  ownerId: string,
  rootId: string
): Promise<string[]> =>
  await db.transaction(async (tx: FilePurgeWriteTransaction) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${ownerId}`}, 0))`
    );
    const ids = await deletingFamilyIds(tx, ownerId, rootId);
    const survivingReference = tx
      .select({ key: eveFileReference.key })
      .from(eveFileReference)
      .where(
        and(
          eq(eveFileReference.key, eveStoredFile.key),
          notInArray(eveFileReference.conversationId, ids)
        )
      );
    const workspaceReference = tx
      .select({ key: eveWorkspaceAttachment.fileKey })
      .from(eveWorkspaceAttachment)
      .innerJoin(
        eveWorkspace,
        eq(eveWorkspace.id, eveWorkspaceAttachment.workspaceId)
      )
      .where(
        and(
          eq(eveWorkspaceAttachment.fileKey, eveStoredFile.key),
          ne(eveWorkspace.state, "deleted")
        )
      );
    const files = await tx
      .update(eveStoredFile)
      .set({ state: "deleting" })
      .where(
        and(
          eq(eveStoredFile.ownerId, ownerId),
          ne(eveStoredFile.state, "deleted"),
          purgeCandidate(tx, ids),
          notExists(survivingReference),
          notExists(workspaceReference)
        )
      )
      .returning({ key: eveStoredFile.key });
    return files.map((file: Readonly<{ key: string }>) => file.key).toSorted();
  });

/** Fence otherwise unreferenced originals after explicit workspace deletion. */
const prepareEveWorkspaceFilePurge = async (
  ownerId: string,
  workspaceId: string
): Promise<string[]> =>
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${ownerId}`}, 0))`
    );
    const [workspace] = await tx
      .select({ state: eveWorkspace.state })
      .from(eveWorkspace)
      .where(
        and(eq(eveWorkspace.id, workspaceId), eq(eveWorkspace.ownerId, ownerId))
      );
    if (workspace?.state !== "deleted") {
      throw new Error(
        "Workspace resources must be deleted before file cleanup."
      );
    }
    const historyReference = tx
      .select({ key: eveFileReference.key })
      .from(eveFileReference)
      .where(eq(eveFileReference.key, eveStoredFile.key));
    const liveWorkspaceReference = tx
      .select({ key: eveWorkspaceAttachment.fileKey })
      .from(eveWorkspaceAttachment)
      .innerJoin(
        eveWorkspace,
        eq(eveWorkspace.id, eveWorkspaceAttachment.workspaceId)
      )
      .where(
        and(
          eq(eveWorkspaceAttachment.fileKey, eveStoredFile.key),
          ne(eveWorkspace.state, "deleted")
        )
      );
    const catalogKeys = tx
      .select({ key: eveWorkspaceAttachment.fileKey })
      .from(eveWorkspaceAttachment)
      .where(
        and(
          eq(eveWorkspaceAttachment.workspaceId, workspaceId),
          eq(eveWorkspaceAttachment.ownerId, ownerId)
        )
      );
    const files = await tx
      .update(eveStoredFile)
      .set({ state: "deleting" })
      .where(
        and(
          eq(eveStoredFile.ownerId, ownerId),
          ne(eveStoredFile.state, "deleted"),
          inArray(eveStoredFile.key, catalogKeys),
          notExists(historyReference),
          notExists(liveWorkspaceReference)
        )
      )
      .returning({ key: eveStoredFile.key });
    return files.map((file) => file.key).toSorted();
  });

/**
 * Call only after the provider confirms removal; no file identity is recycled.
 * @param {string} ownerId Owner used to scope the stored-file state update and family lock.
 * @param {readonly string[]} keys Provider-confirmed removed keys; only deleting rows are marked permanently deleted.
 */
const completeEveFilePurge = async (
  ownerId: string,
  keys: readonly string[]
): Promise<void> => {
  if (keys.length === EMPTY_RESULT_COUNT) {
    return;
  }
  await db.transaction(async (tx: FilePurgeWriteTransaction) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${ownerId}`}, 0))`
    );
    await tx
      .update(eveStoredFile)
      .set({ state: "deleted" })
      .where(
        and(
          eq(eveStoredFile.ownerId, ownerId),
          eq(eveStoredFile.state, "deleting"),
          inArray(eveStoredFile.key, keys)
        )
      );
  });
};

/**
 * Release references only after file cleanup; retry cleanup if another family released first.
 * @param {string} ownerId Owner whose deleting family is locked while file cleanup is checked.
 * @param {string} rootId Family root whose references are released only after all exclusive files are removed.
 */
const releaseEveFamilyFileReferences = async (
  ownerId: string,
  rootId: string
): Promise<void> => {
  await db.transaction(async (tx: FilePurgeWriteTransaction) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${ownerId}`}, 0))`
    );
    const ids = await deletingFamilyIds(tx, ownerId, rootId);
    const outsideReference = tx
      .select({ key: eveFileReference.key })
      .from(eveFileReference)
      .where(
        and(
          eq(eveFileReference.key, eveStoredFile.key),
          notInArray(eveFileReference.conversationId, ids)
        )
      );
    const workspaceReference = tx
      .select({ key: eveWorkspaceAttachment.fileKey })
      .from(eveWorkspaceAttachment)
      .innerJoin(
        eveWorkspace,
        eq(eveWorkspace.id, eveWorkspaceAttachment.workspaceId)
      )
      .where(
        and(
          eq(eveWorkspaceAttachment.fileKey, eveStoredFile.key),
          ne(eveWorkspace.state, "deleted")
        )
      );
    const unremovedRows = await tx
      .select({ key: eveStoredFile.key })
      .from(eveStoredFile)
      .where(
        and(
          eq(eveStoredFile.ownerId, ownerId),
          ne(eveStoredFile.state, "deleted"),
          purgeCandidate(tx, ids),
          notExists(outsideReference),
          notExists(workspaceReference)
        )
      )
      .limit(EXISTENCE_QUERY_LIMIT);
    const unremoved = unremovedRows.at(FIRST_ROW_INDEX);
    if (unremoved) {
      throw new Error(
        "File cleanup is incomplete. Retry before releasing references."
      );
    }
    await tx
      .delete(eveFileReference)
      .where(
        and(
          eq(eveFileReference.ownerId, ownerId),
          inArray(eveFileReference.conversationId, ids)
        )
      );
  });
};
export {
  completeEveFilePurge,
  prepareEveWorkspaceFilePurge,
  prepareEveFamilyFilePurge,
  releaseEveFamilyFileReferences,
};
