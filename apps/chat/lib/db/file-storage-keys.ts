import { eq, inArray } from "drizzle-orm";

import { db } from "./client";
import { eveStoredFile } from "./schema";

/** File references use the stable record key; only storage sees storageKey. */
export const storageKeyForFile = async (fileId: string) => {
  const [file] = await db
    .select({ storageKey: eveStoredFile.storageKey })
    .from(eveStoredFile)
    .where(eq(eveStoredFile.key, fileId));
  if (!file) {
    throw new Error("File is not registered.");
  }
  return file.storageKey;
};

export const fileIdsForStorageKeys = async (storageKeys: string[]) => {
  if (!storageKeys.length) {
    return new Map<string, string>();
  }
  const files = await db
    .select({ fileId: eveStoredFile.key, storageKey: eveStoredFile.storageKey })
    .from(eveStoredFile)
    .where(inArray(eveStoredFile.storageKey, storageKeys));
  return new Map(files.map((file) => [file.storageKey, file.fileId]));
};
