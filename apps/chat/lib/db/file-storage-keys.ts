import { eq, inArray } from "drizzle-orm";

import { db } from "./client";
import { eveStoredFile } from "./schema";

const NO_STORAGE_KEYS = 0;

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

  if (!(file !== undefined)) {
    throw new Error("File is not registered.");
  }
  return file.storageKey;
};

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

export { storageKeyForFile, fileIdsForStorageKeys };
