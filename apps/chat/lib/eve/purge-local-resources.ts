import { fenceLocalEveSandboxMutations } from "./local-sandbox-fence";
import { purgeEveFamilyDocuments } from "@/lib/db/eve-documents";
import { readLocalEveSandboxInventory } from "./local-sandbox-inventory";
import { prepareEveFamilyDeletion } from "./prepare-deletion";
import { purgeEveFamilyCodeSandboxes } from "./purge-code-sandboxes";
import { purgeEveFamilyFiles } from "./purge-files";
import { purgeLocalEveSandboxes } from "./purge-local-sandbox";
import { verifyLocalEveFamilyCoverage } from "./verify-local-coverage";

const NO_UNATTRIBUTED_DIRECTORIES = 0;
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
  await fenceLocalEveSandboxMutations(appRoot, family.runIds);
  await verifyLocalEveFamilyCoverage(
    ownerId,
    appRoot,
    family.nativeInventories
  );
  const inventory = await readLocalEveSandboxInventory(appRoot, family.runIds);
  if (inventory.unattributedDirectories.length > NO_UNATTRIBUTED_DIRECTORIES) {
    throw new Error(
      "Resolve unattributed local sandbox resources before cleanup."
    );
  }
  await purgeLocalEveSandboxes(inventory.owned);
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
  if (!family || family.conversations.length === NO_CONVERSATIONS) {
    return family;
  }
  await purgeOwnedLocalSandboxResources(ownerId, appRoot, family);
  await purgeExternalEveFamilyResources(ownerId, family);
  return family;
};
