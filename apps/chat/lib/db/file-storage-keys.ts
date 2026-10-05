import { eq, inArray } from "drizzle-orm";

import { db } from "./client";
import { eveStoredFile } from "./schema";

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve storageKeyForFile's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable typescript/strict-boolean-expressions --
 * typescript/strict-boolean-expressions (#610): storageKeyForFile intentionally keeps the existing falsy-value behavior of file; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/**
 * File references use the stable record key; only storage sees storageKey.
 * @param {string} fileId Registered application file identity to resolve.
 * @returns {Promise<string>} Provider storage key; unregistered identities throw before provider access.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve fileIdsForStorageKeys's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/strict-boolean-expressions */

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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (storageKeyForFile, fileIdsForStorageKeys); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-magic-numbers */

export { storageKeyForFile, fileIdsForStorageKeys };
/* oxlint-enable import/no-named-export */
