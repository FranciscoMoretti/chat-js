import { and, eq, inArray, lt, notExists, sql } from "drizzle-orm";

import { db } from "./client";
import { eveFileReference, eveStoredFile } from "./schema";

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types --
 * jsdoc/require-param (#534): prepareEveOrphanedFilePurge's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): prepareEveOrphanedFilePurge's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): prepareEveOrphanedFilePurge keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): prepareEveOrphanedFilePurge uses 0, 100 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/explicit-function-return-type (#560): Keep prepareEveOrphanedFilePurge's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep prepareEveOrphanedFilePurge's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): prepareEveOrphanedFilePurge accepts keys: string[]; cutoff: Date; tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/** Storage inventory is only a candidate list; durable ownership and references decide deletion. */
export const prepareEveOrphanedFilePurge = async (
  keys: string[],
  cutoff: Date
) => {
  if (keys.length === 0) {
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
  const files: {
    key: string;
    ownerId: string;
  }[] = [];
  for (const ownerId of [
    ...new Set(candidates.map((file) => file.ownerId)),
  ].toSorted()) {
    files.push(
      // oxlint-disable-next-line eslint/no-await-in-loop -- Keep ordered reads and bounded cleanup sequential.
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
