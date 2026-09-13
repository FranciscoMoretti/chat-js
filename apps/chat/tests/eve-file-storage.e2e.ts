import { eq } from "drizzle-orm";
import { expect, test } from "vitest";

import { db } from "../lib/db/client";
import { prepareEveFamilyFilePurge } from "../lib/db/eve-file-purge";
import { reserveEveGeneratedFile } from "../lib/db/eve-files";
import {
  beginEveConversationDeletion,
  createEveConversation,
} from "../lib/db/eve-queries";
import {
  eveConversation,
  eveFileReference,
  eveStoredFile,
  user,
} from "../lib/db/schema";
import { env } from "../lib/env";
import { purgeEveFamilyFiles } from "../lib/eve/purge-files";
import {
  createFileStorageKey,
  deleteFilesByUrls,
  getFileMetadata,
  uploadFileAtKey,
} from "../lib/file-storage";
import { FILE_CONTENT_PATH } from "../lib/file-url";

if (!["localhost", "127.0.0.1"].includes(new URL(env.DATABASE_URL).hostname)) {
  throw new Error("File removal acceptance requires local Postgres.");
}

test("storage purge removes files and recovers a lost deletion acknowledgement and an unwritten reservation", async () => {
  const owner = crypto.randomUUID();
  const keys = Array.from({ length: 3 }, () =>
    createFileStorageKey("purge.txt")
  );
  const urls = keys.map(
    (key) => `${FILE_CONTENT_PATH}?${new URLSearchParams({ key })}`
  );
  await db.insert(user).values({
    id: owner,
    email: `${owner}@test.invalid`,
    name: "Storage purge fixture",
  });
  try {
    const conversation = await createEveConversation(
      owner,
      crypto.randomUUID(),
      "storage purge",
      async () => crypto.randomUUID()
    );
    for (const key of keys) {
      await reserveEveGeneratedFile(owner, conversation.id, key);
    }
    for (const key of keys.slice(0, 2)) {
      await uploadFileAtKey(
        key,
        "purge.txt",
        "test-owned removal fixture",
        "text/plain"
      );
      expect((await getFileMetadata(key)).size).toBe(26);
    }
    await beginEveConversationDeletion(owner, conversation.id);
    expect(await prepareEveFamilyFilePurge(owner, conversation.id)).toEqual(
      [...keys].sort()
    );
    // Simulate storage success followed by process loss before database completion.
    await deleteFilesByUrls([urls[0]]);
    await purgeEveFamilyFiles(owner, conversation.id);
    await purgeEveFamilyFiles(owner, conversation.id);
    for (const key of keys) {
      // The current adapter classifies BlobNotFoundError as Provider.
      await expect(getFileMetadata(key)).rejects.toThrow(
        "The requested blob does not exist"
      );
    }
    const rows = await db
      .select({ state: eveStoredFile.state })
      .from(eveStoredFile)
      .where(eq(eveStoredFile.ownerId, owner));
    expect(rows).toEqual(keys.map(() => ({ state: "deleted" })));
  } finally {
    await deleteFilesByUrls(urls);
    await db
      .delete(eveFileReference)
      .where(eq(eveFileReference.ownerId, owner));
    await db.delete(eveConversation).where(eq(eveConversation.ownerId, owner));
    await db.delete(eveStoredFile).where(eq(eveStoredFile.ownerId, owner));
    await db.delete(user).where(eq(user.id, owner));
  }
}, 60_000);
