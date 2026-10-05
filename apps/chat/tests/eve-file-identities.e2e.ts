/* oxlint-disable import/no-nodejs-modules, import/no-relative-parent-imports --
 * import/no-nodejs-modules (#529): This test harness requires import { readFile } from "node:fs/promises";; its Node runtime boundary deliberately permits these built-ins.
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/eve-files"; "../lib/db/file-storage-keys"; "../lib/db/schema" dependency within this package instead of introducing an alias or barrel API.
 */
import { readFile } from "node:fs/promises";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { eq, sql } from "drizzle-orm";
/* oxlint-enable sort-imports */
import { expect, test } from "vitest";

import { db } from "../lib/db/client";
import { reserveEveUpload } from "../lib/db/eve-files";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  fileIdsForStorageKeys,
  storageKeyForFile,
} from "../lib/db/file-storage-keys";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { eveStoredFile, user } from "../lib/db/schema";
/* oxlint-enable sort-imports */
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable import/no-nodejs-modules, import/no-relative-parent-imports */

/* oxlint-disable node/no-process-env --
 * node/no-process-env (#537): assertEveTestDatabase reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 */
assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable node/no-process-env */

/* oxlint-disable max-statements, no-magic-numbers --
 * max-statements (#512): test("file identity survives changing its private storage location") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("file identity survives changing its private storage location") uses 0, 24 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, no-magic-numbers */

/* oxlint-disable max-statements, typescript/prefer-readonly-parameter-types --
 * max-statements (#512): test("document migration backfills owned attachments and retention from existing cont keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/prefer-readonly-parameter-types (#565): test("document migration backfills owned attachments and retention from existing cont accepts tx; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-statements, typescript/prefer-readonly-parameter-types */
