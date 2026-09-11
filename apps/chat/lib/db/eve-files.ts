import { eq } from "drizzle-orm";
import { isFileStorageKey } from "../file-url";
import { db } from "./client";
import { eveStoredFile } from "./schema";

/** Register server-created keys only; a caller-supplied URL is not ownership proof. */
export async function registerEveStoredFile(ownerId: string, key: string) {
  if (!(ownerId && isFileStorageKey(key))) {
    throw new Error("Invalid file ownership registration.");
  }
  await db.insert(eveStoredFile).values({ ownerId, key }).onConflictDoNothing();
  const [saved] = await db
    .select({ ownerId: eveStoredFile.ownerId })
    .from(eveStoredFile)
    .where(eq(eveStoredFile.key, key));
  if (saved?.ownerId !== ownerId) {
    throw new Error("File ownership cannot be reassigned.");
  }
}
