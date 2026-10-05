import { completeEveFilePurge } from "@/lib/db/eve-file-purge";
import { prepareEveOrphanedFilePurge } from "@/lib/db/eve-orphaned-files";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { deleteFilesByUrls, iterateStoredFiles } from "@/lib/file-storage";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { createFileUrl, isFileStorageKey } from "@/lib/file-url";
/* oxlint-enable sort-imports */

type OrphanedFile = Awaited<
  ReturnType<typeof prepareEveOrphanedFilePurge>
>[number];

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve cleanupEveOrphanedFiles's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-statements, no-magic-numbers --

 * max-statements (#512): cleanupEveOrphanedFiles keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): cleanupEveOrphanedFiles uses 0, 100 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
  */
/** Only inventoried EVE-owned orphans are eligible; legacy storage is untouched.
 * @param {Readonly<Date>} cutoff Objects uploaded before this time may enter the fenced orphan purge.
 * @returns {Promise<{ deletedCount: number; skipped: boolean }>} The number of deleted stored files and whether the sweep was skipped.
 */
export const cleanupEveOrphanedFiles = async (
  cutoff: Readonly<Date>
): Promise<{ deletedCount: number; skipped: boolean }> => {
  let deletedCount = 0;
  let batch: string[] = [];
  const errors: unknown[] = [];
  const purge = async (keys: readonly string[]): Promise<void> => {
    try {
      const files = await prepareEveOrphanedFilePurge(keys, cutoff);
      if (files.length === 0) {
        return;
      }
      await deleteFilesByUrls(
        files.map(({ key }: Readonly<OrphanedFile>) => createFileUrl(key))
      );
      for (const ownerId of new Set(
        files.map((file: Readonly<OrphanedFile>) => file.ownerId)
      )) {
        // oxlint-disable-next-line eslint/no-await-in-loop -- Process one resource at a time so fencing and cleanup stay ordered and bounded.
        await completeEveFilePurge(
          ownerId,
          files
            .filter((file: Readonly<OrphanedFile>) => file.ownerId === ownerId)
            .map((file: Readonly<OrphanedFile>) => file.key)
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-statements, no-magic-numbers */
