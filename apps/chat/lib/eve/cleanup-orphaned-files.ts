import { createFileUrl, isFileStorageKey } from "@/lib/file-url";
import { completeEveFilePurge } from "@/lib/db/eve-file-purge";
import { prepareEveOrphanedFilePurge } from "@/lib/db/eve-orphaned-files";
import { deleteFilesByUrls, iterateStoredFiles } from "@/lib/file-storage";

const MAX_ORPHAN_PURGE_BATCH_SIZE = 100;

type OrphanedFile = Awaited<
  ReturnType<typeof prepareEveOrphanedFilePurge>
>[number];

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
        // oxlint-disable-next-line eslint/no-await-in-loop -- Storage deletion already succeeded; finish each owner's durable file-purge receipt in this bounded batch before marking the batch counted, preserving stop-on-receipt-failure behavior.
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
      if (batch.length === MAX_ORPHAN_PURGE_BATCH_SIZE) {
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
