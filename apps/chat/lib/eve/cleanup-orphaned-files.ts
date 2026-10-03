/* oxlint-disable import/no-relative-parent-imports, sort-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../db/eve-file-purge"; "../db/eve-orphaned-files"; "../file-storage"; "../file-url" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { completeEveFilePurge } from "../db/eve-file-purge";
import { prepareEveOrphanedFilePurge } from "../db/eve-orphaned-files";
import { deleteFilesByUrls, iterateStoredFiles } from "../file-storage";
import { createFileUrl, isFileStorageKey } from "../file-url";
/* oxlint-enable import/no-relative-parent-imports, sort-imports */

/* oxlint-disable import/no-named-export, import/prefer-default-export, jsdoc/require-param, jsdoc/require-returns, max-statements, no-continue, no-magic-numbers, oxc/no-async-await, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types --
 * import/no-named-export (#527): Preserve the named cleanupEveOrphanedFiles API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): cleanupEveOrphanedFiles remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * jsdoc/require-param (#534): cleanupEveOrphanedFiles's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): cleanupEveOrphanedFiles's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-statements (#512): cleanupEveOrphanedFiles keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-continue (#515): cleanupEveOrphanedFiles skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 * no-magic-numbers (#517): cleanupEveOrphanedFiles uses 0, 100 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): cleanupEveOrphanedFiles sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep cleanupEveOrphanedFiles's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep cleanupEveOrphanedFiles's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): cleanupEveOrphanedFiles accepts cutoff: Date; keys: string[]; { key }; file; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/** Only inventoried EVE-owned orphans are eligible; legacy storage is untouched. */
export const cleanupEveOrphanedFiles = async (cutoff: Date) => {
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
    if (!(isFileStorageKey(file.pathname) && file.uploadedAt < cutoff)) {
      continue;
    }
    batch.push(file.pathname);
    if (batch.length === 100) {
      await purge(batch);
      batch = [];
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
/* oxlint-enable import/no-named-export, import/prefer-default-export, jsdoc/require-param, jsdoc/require-returns, max-statements, no-continue, no-magic-numbers, oxc/no-async-await, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
