import { completeEveFilePurge } from "@/lib/db/eve-file-purge";
import { prepareEveOrphanedFilePurge } from "@/lib/db/eve-orphaned-files";
import { deleteFilesByUrls, iterateStoredFiles } from "@/lib/file-storage";
import { createFileUrl, isFileStorageKey } from "@/lib/file-url";

/* oxlint-disable max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types --

 * max-statements (#512): cleanupEveOrphanedFiles keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): cleanupEveOrphanedFiles uses 0, 100 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): cleanupEveOrphanedFiles accepts cutoff: Date; keys: string[]; { key }; file; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
  */
/** Only inventoried EVE-owned orphans are eligible; legacy storage is untouched.
 * @param {Date} cutoff Objects uploaded before this time may enter the fenced orphan purge.
 * @returns {Promise<{ deletedCount: number; skipped: boolean }>} The number of deleted stored files and whether the sweep was skipped.
 */
export const cleanupEveOrphanedFiles = async (
  cutoff: Date
): Promise<{ deletedCount: number; skipped: boolean }> => {
  let deletedCount = 0;
  let batch: string[] = [];
  const errors: unknown[] = [];
  const purge = async (keys: string[]): Promise<void> => {
    try {
      const files = await prepareEveOrphanedFilePurge(keys, cutoff);
      if (files.length === 0) {
        return;
      }
      await deleteFilesByUrls(files.map(({ key }) => createFileUrl(key)));
      for (const ownerId of new Set(files.map((file) => file.ownerId))) {
        // oxlint-disable-next-line eslint/no-await-in-loop -- Process one resource at a time so fencing and cleanup stay ordered and bounded.
        await completeEveFilePurge(
          ownerId,
          files
            .filter((file) => file.ownerId === ownerId)
            .map((file) => file.key)
        );
      }
      deletedCount += files.length;
    } catch (error) {
      // Failed/partial provider removals retain their fence and can be retried.
      // Continue the sweep so one failing object cannot starve later batches.
      errors.push(error);
    }
  };
  for await (const file of iterateStoredFiles()) {
    if (isFileStorageKey(file.pathname) && file.uploadedAt < cutoff) {
      batch.push(file.pathname);
      if (batch.length === 100) {
        await purge(batch);
        batch = [];
      }
    }
  }
  if (batch.length > 0) {
    await purge(batch);
  }
  if (errors.length > 0) {
    throw new AggregateError(
      errors,
      "EVE orphan cleanup is incomplete; retry cleanup."
    );
  }
  return { deletedCount, skipped: false };
};
/* oxlint-enable max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types */
