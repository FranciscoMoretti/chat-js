import { and, eq, inArray, lt, notExists, sql } from "drizzle-orm";

import { db } from "./client";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { eveFileReference, eveStoredFile } from "./schema";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve prepareEveOrphanedFilePurge's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable sort-imports */

const MAX_ORPHAN_PURGE_BATCH_SIZE = 100;

/* oxlint-disable max-lines-per-function -- Keep candidate ownership checks and per-owner advisory-locked fencing in one transaction workflow. */
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
  // oxlint-disable-next-line no-magic-numbers -- An empty candidate inventory needs no database work.
  if (keys.length === 0) {
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
  const files: {
    key: string;
    ownerId: string;
  }[] = [];
  for (const ownerId of [
    ...new Set(candidates.map((file) => file.ownerId)),
  ].toSorted()) {
    files.push(
      // oxlint-disable-next-line eslint/no-await-in-loop, typescript/prefer-readonly-parameter-types -- Drizzle owns the mutable transaction capability; await each owner lock and fencing transaction before processing the next owner.
      ...(await db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${ownerId}`}, 0))`
        );
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
              eq(eveStoredFile.ownerId, ownerId),
              inArray(eveStoredFile.key, keys),
              lt(eveStoredFile.createdAt, cutoff),
              notExists(references)
            )
          )
          .returning({
            key: eveStoredFile.key,
            ownerId: eveStoredFile.ownerId,
          });
      }))
    );
  }
  return files;
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function */
