import { and, eq, inArray, ne, notExists, notInArray, sql } from "drizzle-orm";

import { db } from "./client";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { eveConversation, eveFileReference, eveStoredFile } from "./schema";
/* oxlint-enable sort-imports */

type TransactionCallback = Extract<
  Parameters<typeof db.transaction>[number],
  (...parameters: readonly never[]) => unknown
>;
type FilePurgeTransaction = Parameters<TransactionCallback>[number];

type FilePurgeReadTransaction = Readonly<Pick<FilePurgeTransaction, "select">>;
type FilePurgeWriteTransaction = Readonly<
  Pick<FilePurgeTransaction, "execute" | "select" | "update" | "delete">
>;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve deletingFamilyIds's awaited sequencing and rejected-Promise behavior. */
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
        eq(eveConversation.chatId, rootId)
      )
    );
  if (
    // oxlint-disable-next-line no-magic-numbers -- An absent family cannot authorize file deletion.
    family.length === 0 ||
    family.some((row: Readonly<{ state: string }>) => row.state !== "deleting")
  ) {
    throw new Error("The entire conversation family must be pending deletion.");
  }
  return family.map((row: Readonly<{ id: string }>) => row.id);
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve prepareEveFamilyFilePurge's awaited sequencing and rejected-Promise behavior. */

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
    return files.map((file: Readonly<{ key: string }>) => file.key).toSorted();
  });
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve completeEveFilePurge's awaited sequencing and rejected-Promise behavior. */

/**
 * Call only after the provider confirms removal; no file identity is recycled.
 * @param {string} ownerId Owner used to scope the stored-file state update and family lock.
 * @param {readonly string[]} keys Provider-confirmed removed keys; only deleting rows are marked permanently deleted.
 */
const completeEveFilePurge = async (
  ownerId: string,
  keys: readonly string[]
): Promise<void> => {
  // oxlint-disable-next-line no-magic-numbers -- An empty confirmed-removal list needs no database transaction.
  if (keys.length === 0) {
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve releaseEveFamilyFileReferences's awaited sequencing and rejected-Promise behavior. */

/* oxlint-disable max-lines-per-function -- Keep the owner advisory lock, deleting-family validation, exclusive-file check and reference deletion visibly ordered under this transaction; extracting helpers must preserve its shared capability and error boundary. */
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
    /* oxlint-disable unicorn/max-nested-calls -- The correlated exclusive-file check selects family keys and excludes outside references before deciding whether cleanup blocks release. */
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
      // oxlint-disable-next-line no-magic-numbers -- One matching row is sufficient to block reference release.
      .limit(1);
    /* oxlint-enable unicorn/max-nested-calls */
    // oxlint-disable-next-line no-magic-numbers -- Inspect the first row of the existence query.
    const unremoved = unremovedRows.at(0);
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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (completeEveFilePurge, prepareEveFamilyFilePurge, releaseEveFamilyFileReferences); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function */
export {
  completeEveFilePurge,
  prepareEveFamilyFilePurge,
  releaseEveFamilyFileReferences,
};
/* oxlint-enable import/no-named-export */
