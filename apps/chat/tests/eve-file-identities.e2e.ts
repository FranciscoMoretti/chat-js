import { readFile } from "node:fs/promises";

import { eq, sql } from "drizzle-orm";
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

test("document migration backfills owned attachments and retention from existing content", async () => {
  const migration = await readFile(
    new URL("../lib/db/migrations/0003_ambitious_oracle.sql", import.meta.url),
    "utf-8"
  );
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`CREATE TEMP TABLE "EveDocumentRevision" ("id" text, "conversationId" text, "ownerId" text, "content" text) ON COMMIT DROP`
    );
    await tx.execute(
      sql`CREATE TEMP TABLE "EveStoredFile" ("key" text, "ownerId" text, "state" text) ON COMMIT DROP`
    );
    await tx.execute(
      sql`CREATE TEMP TABLE "EveFileReference" ("conversationId" text, "key" text, "ownerId" text, PRIMARY KEY ("conversationId", "key")) ON COMMIT DROP`
    );
    const image = "abcdefghijklmnopqrstuvwx.png";
    const video = "zyxwvutsrqponmlkjihgfedc.mp4";
    const foreign = "111111111111111111111111.png";
    const deleted = "222222222222222222222222.png";
    await tx.execute(
      sql`INSERT INTO "EveStoredFile" VALUES (${image}, 'owner', 'active'), (${video}, 'owner', 'active'), (${foreign}, 'stranger', 'active'), (${deleted}, 'owner', 'deleted')`
    );
    const content = `![image](/api/files/${image}?dpl=test),https://example.com/api/files/${video} /api/files/${image} /api/files/${foreign} /api/files/${deleted}`;
    await tx.execute(
      sql`INSERT INTO "EveDocumentRevision" VALUES ('with-files', 'chat', 'owner', ${content}), ('empty', 'chat', 'owner', 'No attachments')`
    );
    for (const statement of migration.split("--> statement-breakpoint")) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Run migration statements in their declared order.
      await tx.execute(sql.raw(statement));
    }
    const revisions = await tx.execute(
      sql`SELECT "id", "fileIds" FROM "EveDocumentRevision" ORDER BY "id"`
    );
    expect([...revisions]).toEqual([
      { fileIds: [], id: "empty" },
      { fileIds: [image, video], id: "with-files" },
    ]);
    const references = await tx.execute(
      sql`SELECT "key" FROM "EveFileReference" ORDER BY "key"`
    );
    expect([...references]).toEqual([{ key: image }, { key: video }]);
  });
});
