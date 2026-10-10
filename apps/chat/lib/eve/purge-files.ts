import {
  completeEveFilePurge,
  prepareEveFamilyFilePurge,
  releaseEveFamilyFileReferences,
} from "@/lib/db/eve-file-purge";
import { createFileUrl } from "@/lib/file-url";
import { deleteFilesByUrls } from "@/lib/file-storage";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (purgeEveFamilyFiles); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve purgeEveFamilyFiles's awaited sequencing and rejected-Promise behavior. */

const NO_FILE_KEYS = 0;
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
  if (keys.length > NO_FILE_KEYS) {
    await deleteFilesByUrls(keys.map((key) => createFileUrl(key)));
    await completeEveFilePurge(ownerId, keys);
  }
  await releaseEveFamilyFileReferences(ownerId, rootId);
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
