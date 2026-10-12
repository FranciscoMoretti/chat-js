import { createEveTestSession } from "./eve-native-session.fixture";

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
  createFileId,
  deleteFilesByUrls,
  getFileMetadata,
  uploadFileAtKey,
} from "../lib/file-storage";
import { createFileUrl } from "../lib/file-url";

if (!["localhost", "127.0.0.1"].includes(new URL(env.DATABASE_URL).hostname)) {
  throw new Error("File removal acceptance requires local Postgres.");
}

test("storage purge removes files and recovers a lost deletion acknowledgement and an unwritten reservation", async () => {
  const owner = crypto.randomUUID();
  const keys = Array.from({ length: 3 }, () => createFileId());
  const urls = keys.map((key) => createFileUrl(key));
  await db.insert(user).values({
    email: `${owner}@test.invalid`,
    id: owner,
    name: "Storage purge fixture",
  });
  try {
    const conversation = await createEveConversation(
      owner,
      crypto.randomUUID(),
      "storage purge",
      createEveTestSession
    );
    await Promise.all(
      keys.map(async (key) => {
        await reserveEveGeneratedFile(owner, conversation.id, key);
      })
    );
    await Promise.all(
      keys.slice(0, 2).map(async (key) => {
        await uploadFileAtKey(
          key,
          "purge.txt",
          "test-owned removal fixture",
          "text/plain"
        );
        const purgedFileMetadata = await getFileMetadata(key);
        expect(purgedFileMetadata.size).toBe(26);
      })
    );
    await beginEveConversationDeletion(owner, conversation.id);
    expect(await prepareEveFamilyFilePurge(owner, conversation.id)).toEqual(
      [...keys].toSorted()
    );
    // Simulate storage success followed by process loss before database completion.
    await deleteFilesByUrls([urls[0]]);
    await purgeEveFamilyFiles(owner, conversation.id);
    await purgeEveFamilyFiles(owner, conversation.id);
    await Promise.all(
      keys.map(async (key) => {
        // The current adapter classifies BlobNotFoundError as Provider.
        await expect(getFileMetadata(key)).rejects.toThrow(
          "The requested blob does not exist"
        );
      })
    );
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
