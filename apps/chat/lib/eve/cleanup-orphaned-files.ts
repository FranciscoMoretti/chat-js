import { completeEveFilePurge } from "../db/eve-file-purge";
import { prepareEveOrphanedFilePurge } from "../db/eve-orphaned-files";
import { deleteFilesByUrls, iterateStoredFiles } from "../file-storage";
import { FILE_CONTENT_PATH, isFileStorageKey } from "../file-url";

/** Only inventoried EVE-owned orphans are eligible; legacy storage is untouched. */
export const cleanupEveOrphanedFiles = async (cutoff: Date) => {
  let deletedCount = 0;
  let batch: string[] = [];
  const errors: unknown[] = [];
  const purge = async (keys: string[]) => {
    try {
      const files = await prepareEveOrphanedFilePurge(keys, cutoff);
      if (!files.length) {
        return;
      }
      await deleteFilesByUrls(
        files.map(
          ({ key }) => `${FILE_CONTENT_PATH}?${new URLSearchParams({ key })}`
        )
      );
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
    if (!(isFileStorageKey(file.pathname) && file.uploadedAt < cutoff)) {
      continue;
    }
    batch.push(file.pathname);
    if (batch.length === 100) {
      await purge(batch);
      batch = [];
    }
  }
  if (batch.length) {
    await purge(batch);
  }
  if (errors.length) {
    throw new AggregateError(
      errors,
      "EVE orphan cleanup is incomplete; retry cleanup."
    );
  }
  return { deletedCount, skipped: false };
};
