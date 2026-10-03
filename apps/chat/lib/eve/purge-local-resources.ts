/* oxlint-disable import/no-relative-parent-imports, sort-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../db/eve-documents" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { purgeEveFamilyDocuments } from "../db/eve-documents";
import { fenceLocalEveSandboxMutations } from "./local-sandbox-fence";
import { readLocalEveSandboxInventory } from "./local-sandbox-inventory";
import { prepareEveFamilyDeletion } from "./prepare-deletion";
import { purgeEveFamilyCodeSandboxes } from "./purge-code-sandboxes";
import { purgeEveFamilyFiles } from "./purge-files";
import { purgeLocalEveSandboxes } from "./purge-local-sandbox";
import { verifyLocalEveFamilyCoverage } from "./verify-local-coverage";
/* oxlint-enable import/no-relative-parent-imports, sort-imports */

/* oxlint-disable import/no-named-export, import/prefer-default-export, jsdoc/require-param, jsdoc/require-returns, max-statements, no-magic-numbers, oxc/no-async-await, oxc/no-optional-chaining, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions --
 * import/no-named-export (#527): Preserve the named purgeLocalEveFamilyResources API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): purgeLocalEveFamilyResources remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * jsdoc/require-param (#534): purgeLocalEveFamilyResources's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): purgeLocalEveFamilyResources's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-statements (#512): purgeLocalEveFamilyResources keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): purgeLocalEveFamilyResources uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): purgeLocalEveFamilyResources sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): purgeLocalEveFamilyResources handles optional family?.conversations.length without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/explicit-function-return-type (#560): Keep purgeLocalEveFamilyResources's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep purgeLocalEveFamilyResources's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/strict-boolean-expressions (#610): purgeLocalEveFamilyResources intentionally keeps the existing falsy-value behavior of family?.conversations.length; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
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
/* oxlint-enable import/no-named-export, import/prefer-default-export, jsdoc/require-param, jsdoc/require-returns, max-statements, no-magic-numbers, oxc/no-async-await, oxc/no-optional-chaining, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions */
