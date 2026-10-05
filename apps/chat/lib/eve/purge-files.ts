import {
  completeEveFilePurge,
  prepareEveFamilyFilePurge,
  releaseEveFamilyFileReferences,
} from "@/lib/db/eve-file-purge";
import { deleteFilesByUrls } from "@/lib/file-storage";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { createFileUrl } from "@/lib/file-url";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (purgeEveFamilyFiles); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve purgeEveFamilyFiles's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable sort-imports */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): purgeEveFamilyFiles uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
/** Internal deletion stage; requires native retirement/accounting settlement or never-dispatched copy proof.
 * @param {string} ownerId Owner authorizing the family file-reference release.
 * @param {string} rootId Retired family root whose retained file keys are prepared for purge.
 * @returns {Promise<void>} Completes storage deletion and file-purge receipts before releasing family references; storage or database failures reject and leave retry work pending.
 */
export const purgeEveFamilyFiles = async (
  ownerId: string,
  rootId: string
): Promise<void> => {
  const keys = await prepareEveFamilyFilePurge(ownerId, rootId);
  if (keys.length > 0) {
    await deleteFilesByUrls(keys.map((key) => createFileUrl(key)));
    await completeEveFilePurge(ownerId, keys);
  }
  await releaseEveFamilyFileReferences(ownerId, rootId);
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-magic-numbers */
