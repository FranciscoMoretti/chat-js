import { and, eq, inArray, ne, notExists, notInArray, sql } from "drizzle-orm";

import { db } from "./client";
import { eveConversation, eveFileReference, eveStoredFile } from "./schema";

const EMPTY_COLLECTION_LENGTH = 0;
const FIRST_ROW_INDEX = 0;
const FIRST_ARGUMENT_INDEX = 0;
const SINGLE_ROW_LIMIT = 1;

/* oxlint-disable typescript/prefer-readonly-parameter-types -- * typescript/prefer-readonly-parameter-types (#565): deletingFamilyIds accepts tx: Parameters<Parameters<typeof db.transaction>[typeof FIRST_ARGUMENT_INDEX]>[typeof FIRST_ARGUMENT_INDEX]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
const deletingFamilyIds = async (
  tx: Parameters<
    Parameters<typeof db.transaction>[typeof FIRST_ARGUMENT_INDEX]
  >[typeof FIRST_ARGUMENT_INDEX],
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
        eq(eveConversation.chatId, rootId)
      )
    );
  if (
    family.length === EMPTY_COLLECTION_LENGTH ||
    family.some((row) => row.state !== "deleting")
  ) {
    throw new Error("The entire conversation family must be pending deletion.");
  }
  return family.map((row) => row.id);
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- typescript/prefer-readonly-parameter-types (#565): prepareEveFamilyFilePurge accepts tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
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
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${ownerId}`}, 0))`
    );
    const ids = await deletingFamilyIds(tx, ownerId, rootId);
    const referencedKeys = tx
      .select({ key: eveFileReference.key })
      .from(eveFileReference)
      .where(inArray(eveFileReference.conversationId, ids));
    const survivingReference = tx
      .select({ key: eveFileReference.key })
      .from(eveFileReference)
      .where(
        and(
          eq(eveFileReference.key, eveStoredFile.key),
          notInArray(eveFileReference.conversationId, ids)
        )
      );
    const files = await tx
      .update(eveStoredFile)
      .set({ state: "deleting" })
      .where(
        and(
          eq(eveStoredFile.ownerId, ownerId),
          ne(eveStoredFile.state, "deleted"),
          inArray(eveStoredFile.key, referencedKeys),
          notExists(survivingReference)
        )
      )
      .returning({ key: eveStoredFile.key });
    return files.map((file) => file.key).toSorted();
  });
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- typescript/prefer-readonly-parameter-types (#565): completeEveFilePurge accepts keys: readonly string[]; tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
/**
 * Call only after the provider confirms removal; no file identity is recycled.
 * @param {string} ownerId Owner used to scope the stored-file state update and family lock.
 * @param {readonly string[]} keys Provider-confirmed removed keys; only deleting rows are marked permanently deleted.
 */
const completeEveFilePurge = async (
  ownerId: string,
  keys: readonly string[]
): Promise<void> => {
  if (keys.length === EMPTY_COLLECTION_LENGTH) {
    return;
  }
  await db.transaction(async (tx) => {
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-lines-per-function, typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls -- max-lines-per-function (#510): releaseEveFamilyFileReferences keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
typescript/prefer-readonly-parameter-types (#565): releaseEveFamilyFileReferences accepts tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
unicorn/max-nested-calls (#568): releaseEveFamilyFileReferences keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold. */
/**
 * Release references only after file cleanup; retry cleanup if another family released first.
 * @param {string} ownerId Owner whose deleting family is locked while file cleanup is checked.
 * @param {string} rootId Family root whose references are released only after all exclusive files are removed.
 */
const releaseEveFamilyFileReferences = async (
  ownerId: string,
  rootId: string
): Promise<void> => {
  await db.transaction(async (tx) => {
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
    const unremovedRows = await tx
      .select({ key: eveStoredFile.key })
      .from(eveStoredFile)
      .where(
        and(
          eq(eveStoredFile.ownerId, ownerId),
          ne(eveStoredFile.state, "deleted"),
          inArray(
            eveStoredFile.key,
            tx
              .select({ key: eveFileReference.key })
              .from(eveFileReference)
              .where(inArray(eveFileReference.conversationId, ids))
          ),
          notExists(outsideReference)
        )
      )
      .limit(SINGLE_ROW_LIMIT);
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
/* oxlint-enable max-lines-per-function, typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls */
export {
  completeEveFilePurge,
  prepareEveFamilyFilePurge,
  releaseEveFamilyFileReferences,
};
