import { eq, inArray } from "drizzle-orm";

import { db } from "./client";
import { eveStoredFile } from "./schema";

const NO_STORAGE_KEYS = 0;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve storageKeyForFile's awaited sequencing and rejected-Promise behavior. */
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
  // oxlint-disable-next-line typescript/strict-boolean-expressions -- The query has no first row when the file is missing; preserve its exact guard and ordinary Error path.
  if (!file) {
    throw new Error("File is not registered.");
  }
  return file.storageKey;
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve fileIdsForStorageKeys's awaited sequencing and rejected-Promise behavior. */

const fileIdsForStorageKeys = async (
  storageKeys: readonly string[]
): Promise<Map<string, string>> => {
  if (storageKeys.length === NO_STORAGE_KEYS) {
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

export { storageKeyForFile, fileIdsForStorageKeys };
/* oxlint-enable import/no-named-export */
