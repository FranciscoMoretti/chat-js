/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../db/eve-file-purge"; "../file-storage"; "../file-url" dependency within this package instead of introducing an alias or barrel API.
 */
import {
  completeEveFilePurge,
  prepareEveFamilyFilePurge,
  releaseEveFamilyFileReferences,
} from "../db/eve-file-purge";
import { deleteFilesByUrls } from "../file-storage";
import { createFileUrl } from "../file-url";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable jsdoc/require-param, no-magic-numbers --
 * jsdoc/require-param (#534): purgeEveFamilyFiles's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * no-magic-numbers (#517): purgeEveFamilyFiles uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
/** Internal deletion stage; requires native retirement/accounting settlement or never-dispatched copy proof. */
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
/* oxlint-enable jsdoc/require-param, no-magic-numbers */
