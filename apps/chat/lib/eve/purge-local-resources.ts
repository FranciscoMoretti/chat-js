import { purgeEveFamilyDocuments } from "@/lib/db/eve-documents";
import { prepareEveFamilyDeletion } from "./prepare-deletion";
import { purgeEveFamilyCodeSandboxes } from "./purge-code-sandboxes";
import { purgeEveFamilyFiles } from "./purge-files";
import { cleanupRetiredEveWorkspaces } from "./persistent-sandbox-store";
import { getPersistentSandboxProvider } from "../sandbox/runtime";
import {
  manageEveLocalResources,
  verifyLocalEveFamilyCoverage,
} from "./verify-local-coverage";

const NO_CONVERSATIONS = 0;

const purgeOwnedLocalSandboxResources = async (
  ownerId: string,
  appRoot: string,
  family: {
    readonly runIds: readonly string[];
    readonly nativeInventories: readonly {
      readonly sessionId: string;
      readonly runIds: readonly string[];
    }[];
  }
): Promise<void> => {
  const scope = await verifyLocalEveFamilyCoverage(
    ownerId,
    appRoot,
    family.nativeInventories
  );
  for (const session of scope.sessions) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Confirm every owned resource is absent before allowing family erasure.
    await manageEveLocalResources(ownerId, session, "purge");
  }
};

const purgeExternalEveFamilyResources = async (
  ownerId: string,
  family: Readonly<{ rootId: string }>
): Promise<void> => {
  await purgeEveFamilyCodeSandboxes(ownerId, family.rootId);
  await purgeEveFamilyDocuments(ownerId, family.rootId);
  await purgeEveFamilyFiles(ownerId, family.rootId);
};

/**
 * Internal local-provider coordinator. Native history and deleting bindings remain
 * until external tool resources are accounted for and final erasure can proceed.
 * appRoot must be the worker's actual app root, never a request-controlled path.
 * @param {string} ownerId Owner authorizing the local family resource purge.
 * @param {string} conversationId Conversation resolving the retired deletion family.
 * @param {string} appRoot Trusted local worker root used for sandbox inventory and fences.
 * @returns {ReturnType<typeof prepareEveFamilyDeletion>} The prepared family after external sandbox/document/file stages, or the unchanged absent/empty family result. Unattributed resource evidence or failed cleanup rejects before final native/application erasure.
 */
export const purgeLocalEveFamilyResources = async (
  ownerId: string,
  conversationId: string,
  appRoot: string
): ReturnType<typeof prepareEveFamilyDeletion> => {
  const family = await prepareEveFamilyDeletion(ownerId, conversationId);
  if (!family) {
    return family;
  }
  if (family.conversations.length > NO_CONVERSATIONS) {
    await purgeOwnedLocalSandboxResources(ownerId, appRoot, family);
  }
  await cleanupRetiredEveWorkspaces(
    ownerId,
    family.rootId,
    getPersistentSandboxProvider
  );
  await purgeExternalEveFamilyResources(ownerId, family);
  return family;
};
