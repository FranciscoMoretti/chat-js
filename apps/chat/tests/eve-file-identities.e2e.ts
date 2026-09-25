import { eq } from "drizzle-orm";
import { expect, test } from "vitest";

import { db } from "../lib/db/client";
import { reserveEveUpload } from "../lib/db/eve-files";
import {
  fileIdsForStorageKeys,
  storageKeyForFile,
} from "../lib/db/file-storage-keys";
import { eveStoredFile, user } from "../lib/db/schema";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");

test("file identity survives changing its private storage location", async () => {
  const owner = crypto.randomUUID();
  const fileId = crypto.randomUUID().replaceAll("-", "").slice(0, 24);
  await db.insert(user).values({
    email: `${owner}@test.invalid`,
    id: owner,
    name: "File identity test",
  });
  try {
    await reserveEveUpload(owner, fileId);
    const storageKey = await storageKeyForFile(fileId);
    expect(storageKey).not.toBe(fileId);
    const ids = await fileIdsForStorageKeys([storageKey]);
    expect(ids.get(storageKey)).toBe(fileId);
    const movedKey = `moved/${crypto.randomUUID()}`;
    await db
      .update(eveStoredFile)
      .set({ storageKey: movedKey })
      .where(eq(eveStoredFile.key, fileId));
    expect(await storageKeyForFile(fileId)).toBe(movedKey);
    expect(await fileIdsForStorageKeys([storageKey, movedKey])).toEqual(
      new Map([[movedKey, fileId]])
    );
    await expect(storageKeyForFile("unregistered")).rejects.toThrow(
      "not registered"
    );
  } finally {
    await db.delete(eveStoredFile).where(eq(eveStoredFile.ownerId, owner));
    await db.delete(user).where(eq(user.id, owner));
  }
});
