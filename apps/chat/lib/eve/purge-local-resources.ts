import { purgeEveFamilyDocuments } from "../db/eve-documents";
import { fenceLocalEveSandboxMutations } from "./local-sandbox-fence";
import { readLocalEveSandboxInventory } from "./local-sandbox-inventory";
import { prepareEveFamilyDeletion } from "./prepare-deletion";
import { purgeEveFamilyCodeSandboxes } from "./purge-code-sandboxes";
import { purgeEveFamilyFiles } from "./purge-files";
import { purgeLocalEveSandboxes } from "./purge-local-sandbox";
import { verifyLocalEveFamilyCoverage } from "./verify-local-coverage";

/**
 * Internal local-provider coordinator. Native history and deleting bindings remain
 * until external tool resources are accounted for and final erasure can proceed.
 * appRoot must be the worker's actual app root, never a request-controlled path.
 */
export const purgeLocalEveFamilyResources = async (
  ownerId: string,
  conversationId: string,
  appRoot: string
) => {
  const family = await prepareEveFamilyDeletion(ownerId, conversationId);
  if (!family?.conversations.length) {
    return family;
  }
  await fenceLocalEveSandboxMutations(appRoot, family.runIds);
  await verifyLocalEveFamilyCoverage(
    ownerId,
    appRoot,
    family.nativeInventories
  );
  const inventory = await readLocalEveSandboxInventory(appRoot, family.runIds);
  if (inventory.unattributedDirectories.length) {
    throw new Error(
      "Resolve unattributed local sandbox resources before cleanup."
    );
  }
  await purgeLocalEveSandboxes(inventory.owned);
  await purgeEveFamilyCodeSandboxes(ownerId, family.rootId);
  await purgeEveFamilyDocuments(ownerId, family.rootId);
  await purgeEveFamilyFiles(ownerId, family.rootId);
  return family;
};
