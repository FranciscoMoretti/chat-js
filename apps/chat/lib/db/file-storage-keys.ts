import { eq } from "drizzle-orm";

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

export const fileIdForStorageKey = async (storageKey: string) => {
  const [file] = await db
    .select({ fileId: eveStoredFile.key })
    .from(eveStoredFile)
    .where(eq(eveStoredFile.storageKey, storageKey));
  return file?.fileId;
};
