import { and, eq, inArray, ne, notExists, notInArray, sql } from "drizzle-orm";

import { db } from "./client";
import { eveConversation, eveFileReference, eveStoredFile } from "./schema";

/* oxlint-disable no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types --
 * no-magic-numbers (#517): deletingFamilyIds uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/explicit-function-return-type (#560): Keep deletingFamilyIds's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): deletingFamilyIds accepts tx: Parameters<Parameters<typeof db.transaction>[0]>[0]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const deletingFamilyIds = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ownerId: string,
  rootId: string
) => {
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
  if (family.length === 0 || family.some((row) => row.state !== "deleting")) {
    throw new Error("The entire conversation family must be pending deletion.");
  }
  return family.map((row) => row.id);
};
/* oxlint-enable no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types --
 * import/group-exports (#523): prepareEveFamilyFilePurge stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): prepareEveFamilyFilePurge's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): prepareEveFamilyFilePurge's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * typescript/explicit-function-return-type (#560): Keep prepareEveFamilyFilePurge's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep prepareEveFamilyFilePurge's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): prepareEveFamilyFilePurge accepts tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/** Fence exclusively referenced files before external deletion; retain references for retries. */
export const prepareEveFamilyFilePurge = async (
  ownerId: string,
  rootId: string
) =>
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
/* oxlint-enable import/group-exports, jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, jsdoc/require-param, no-magic-numbers, typescript/prefer-readonly-parameter-types --
 * import/group-exports (#523): completeEveFilePurge stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): completeEveFilePurge's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * no-magic-numbers (#517): completeEveFilePurge uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): completeEveFilePurge accepts keys: string[]; tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/** Call only after the provider confirms removal; no file identity is recycled. */
export const completeEveFilePurge = async (
  ownerId: string,
  keys: string[]
): Promise<void> => {
  if (keys.length === 0) {
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
/* oxlint-enable import/group-exports, jsdoc/require-param, no-magic-numbers, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, jsdoc/require-param, max-lines-per-function, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/max-nested-calls --
 * import/group-exports (#523): releaseEveFamilyFileReferences stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): releaseEveFamilyFileReferences's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): releaseEveFamilyFileReferences keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): releaseEveFamilyFileReferences uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): releaseEveFamilyFileReferences accepts tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): releaseEveFamilyFileReferences intentionally keeps the existing falsy-value behavior of unremoved; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/max-nested-calls (#568): releaseEveFamilyFileReferences keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
/** Release references only after file cleanup; retry cleanup if another family released first. */
export const releaseEveFamilyFileReferences = async (
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
    const [unremoved] = await tx
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
      .limit(1);
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
/* oxlint-enable import/group-exports, jsdoc/require-param, max-lines-per-function, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/max-nested-calls */
