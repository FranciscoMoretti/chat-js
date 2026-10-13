import { and, eq, inArray, lt, notExists } from "drizzle-orm";

import { db } from "./client";
import { lockEveCopyOwners } from "./eve-copy-journal";
import { eveFileReference, eveStoredFile } from "./schema";

const MAX_ORPHAN_PURGE_BATCH_SIZE = 100;
const EMPTY_RESULT_COUNT = 0;

type OrphanPurgeTransaction = Readonly<
  Pick<typeof db, "select" | "execute" | "update">
>;

/**
 * Storage inventory is only a candidate list; durable ownership and references decide deletion.
 * @param {readonly string[]} keys Inventoried storage keys to recheck against durable ownership and references.
 * @param {Readonly<Date>} cutoff Only files created before this instant are eligible for fencing.
 * @returns {Promise<{ key: string; ownerId: string }[]>} Owner-scoped keys fenced as deleting while their family lock is held; referenced or newer files are excluded.
 */
export const prepareEveOrphanedFilePurge = async (
  keys: readonly string[],
  cutoff: Readonly<Date>
): Promise<{ key: string; ownerId: string }[]> => {
  if (keys.length === EMPTY_RESULT_COUNT) {
    return [];
  }
  if (keys.length > MAX_ORPHAN_PURGE_BATCH_SIZE) {
    throw new Error("File cleanup batch is too large.");
  }
  const candidates = await db
    .select({ ownerId: eveStoredFile.ownerId })
    .from(eveStoredFile)
    .where(
      and(inArray(eveStoredFile.key, keys), lt(eveStoredFile.createdAt, cutoff))
    );
  const owners = [...new Set(candidates.map((file) => file.ownerId))];
  if (owners.length === EMPTY_RESULT_COUNT) {
    return [];
  }
  return await db.transaction(async (tx: OrphanPurgeTransaction) => {
    // Copy and cleanup must acquire every family lock in the same owner order.
    await lockEveCopyOwners(tx, owners);
    const references = tx
      .select({ key: eveFileReference.key })
      .from(eveFileReference)
      .where(eq(eveFileReference.key, eveStoredFile.key));
    // Include tombstones: a provider can finish an uncertain write after an
    // earlier deletion. A later inventory pass must remove that object again.
    return await tx
      .update(eveStoredFile)
      .set({ state: "deleting" })
      .where(
        and(
          inArray(eveStoredFile.ownerId, owners),
          inArray(eveStoredFile.key, keys),
          lt(eveStoredFile.createdAt, cutoff),
          notExists(references)
        )
      )
      .returning({
        key: eveStoredFile.key,
        ownerId: eveStoredFile.ownerId,
      });
  });
};
