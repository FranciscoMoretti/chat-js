/* oxlint-disable import/max-dependencies, import/no-relative-parent-imports --
 * import/max-dependencies (#524): import from "drizzle-orm" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/eve-file-purge"; "../lib/db/eve-files"; "../lib/db/eve-queries"; "../lib/db/schema" dependency within this package instead of introducing an alias or barrel API.
 */
/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
/* oxlint-disable eslint/require-await -- Async mocks preserve the Promise-returning production callback contract. */
/* oxlint-disable unicorn/no-await-expression-member -- Direct awaited assertions keep each test action tied to its expectation. */
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
/* oxlint-enable import/max-dependencies, import/no-relative-parent-imports */

if (!["localhost", "127.0.0.1"].includes(new URL(env.DATABASE_URL).hostname)) {
  throw new Error("File removal acceptance requires local Postgres.");
}

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers --
 * max-lines-per-function (#510): test("storage purge removes files and recovers a lost deletion acknowledgement and an keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("storage purge removes files and recovers a lost deletion acknowledgement and an keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("storage purge removes files and recovers a lost deletion acknowledgement and an uses 0, 2, 26, 60_000 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
      [...keys].toSorted()
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
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers */
