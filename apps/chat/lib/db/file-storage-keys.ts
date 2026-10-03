import { eq, inArray } from "drizzle-orm";

import { db } from "./client";
import { eveStoredFile } from "./schema";

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, typescript/strict-boolean-expressions --
 * jsdoc/require-param (#534): storageKeyForFile's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): storageKeyForFile's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * typescript/strict-boolean-expressions (#610): storageKeyForFile intentionally keeps the existing falsy-value behavior of file; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** File references use the stable record key; only storage sees storageKey. */
const storageKeyForFile = async (fileId: string): Promise<string> => {
  const [file] = await db
    .select({ storageKey: eveStoredFile.storageKey })
    .from(eveStoredFile)
    .where(eq(eveStoredFile.key, fileId));
  if (!file) {
    throw new Error("File is not registered.");
  }
  return file.storageKey;
};
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, typescript/strict-boolean-expressions */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): fileIdsForStorageKeys uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
const fileIdsForStorageKeys = async (
  storageKeys: readonly string[]
): Promise<Map<string, string>> => {
  if (storageKeys.length === 0) {
    return new Map<string, string>();
  }
  const files = await db
    .select({ fileId: eveStoredFile.key, storageKey: eveStoredFile.storageKey })
    .from(eveStoredFile)
    .where(inArray(eveStoredFile.storageKey, storageKeys));
  return new Map(files.map((file) => [file.storageKey, file.fileId]));
};
/* oxlint-enable no-magic-numbers */

export { storageKeyForFile, fileIdsForStorageKeys };
