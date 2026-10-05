import { purgeEveFamilyDocuments } from "@/lib/db/eve-documents";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { fenceLocalEveSandboxMutations } from "./local-sandbox-fence";
/* oxlint-enable sort-imports */
import { readLocalEveSandboxInventory } from "./local-sandbox-inventory";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { prepareEveFamilyDeletion } from "./prepare-deletion";
/* oxlint-enable sort-imports */
import { purgeEveFamilyCodeSandboxes } from "./purge-code-sandboxes";
import { purgeEveFamilyFiles } from "./purge-files";
import { purgeLocalEveSandboxes } from "./purge-local-sandbox";
import { verifyLocalEveFamilyCoverage } from "./verify-local-coverage";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (purgeLocalEveFamilyResources); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve purgeLocalEveFamilyResources's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-statements, no-magic-numbers, typescript/strict-boolean-expressions --
 * max-statements (#512): purgeLocalEveFamilyResources keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): purgeLocalEveFamilyResources uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/strict-boolean-expressions (#610): purgeLocalEveFamilyResources intentionally keeps the existing falsy-value behavior of family?.conversations.length; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
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
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading conversations from family; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
  if (inventory.unattributedDirectories.length > 0) {
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-statements, no-magic-numbers, typescript/strict-boolean-expressions */
