import {
  completeEveFilePurge,
  prepareEveFamilyFilePurge,
  prepareEveWorkspaceFilePurge,
  releaseEveFamilyFileReferences,
} from "@/lib/db/eve-file-purge";
import { createFileUrl } from "@/lib/file-url";
import { deleteFilesByUrls } from "@/lib/file-storage";

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

/** Retryable cleanup for an explicitly deleted empty workspace's original uploads. */
export const purgeEveWorkspaceFiles = async (
  ownerId: string,
  workspaceId: string
): Promise<void> => {
  const keys = await prepareEveWorkspaceFilePurge(ownerId, workspaceId);
  if (keys.length > NO_FILE_KEYS) {
    await deleteFilesByUrls(keys.map((key) => createFileUrl(key)));
    await completeEveFilePurge(ownerId, keys);
  }
};
