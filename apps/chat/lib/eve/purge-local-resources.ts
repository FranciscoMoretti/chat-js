import { prepareEveFamilyDeletion } from "./prepare-deletion";
import { purgeEveFamilyFiles } from "./purge-files";
import { cleanupRetiredEveWorkspaces } from "../db/eve-workspace-deletion";

const purgeExternalEveFamilyResources = async (
  ownerId: string,
  family: Readonly<{ rootId: string }>
): Promise<void> => {
  await purgeEveFamilyFiles(ownerId, family.rootId);
};

/**
 * Internal local-provider coordinator. Native history and deleting bindings remain
 * until external tool resources are accounted for and final erasure can proceed.
 * @param {string} ownerId Owner authorizing the local family resource purge.
 * @param {string} conversationId Conversation resolving the retired deletion family.
 * @returns {ReturnType<typeof prepareEveFamilyDeletion>} The prepared family after external sandbox/file stages, or the unchanged absent/empty family result. Unattributed resource evidence or failed cleanup rejects before final native/application erasure.
 */
export const purgeLocalEveFamilyResources = async (
  ownerId: string,
  conversationId: string
): ReturnType<typeof prepareEveFamilyDeletion> => {
  const family = await prepareEveFamilyDeletion(ownerId, conversationId);
  if (!family) {
    return family;
  }
  await cleanupRetiredEveWorkspaces(ownerId, family.rootId);
  await purgeExternalEveFamilyResources(ownerId, family);
  return family;
};
