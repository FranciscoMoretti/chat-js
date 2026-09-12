import { and, eq, inArray, lt, notExists, sql } from "drizzle-orm";
import { db } from "./client";
import { eveFileReference, eveStoredFile } from "./schema";

/** Storage inventory is only a candidate list; durable ownership and references decide deletion. */
export async function prepareEveOrphanedFilePurge(
  keys: string[],
  cutoff: Date
) {
  if (!keys.length) {
    return [];
  }
  if (keys.length > 100) {
    throw new Error("File cleanup batch is too large.");
  }
  const candidates = await db
    .select({ ownerId: eveStoredFile.ownerId })
    .from(eveStoredFile)
    .where(
      and(inArray(eveStoredFile.key, keys), lt(eveStoredFile.createdAt, cutoff))
    );
  const files: Array<{ key: string; ownerId: string }> = [];
  for (const ownerId of [
    ...new Set(candidates.map((file) => file.ownerId)),
  ].sort()) {
    files.push(
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
}
