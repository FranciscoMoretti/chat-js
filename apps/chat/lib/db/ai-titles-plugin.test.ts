import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, expect, test, vi } from "vitest";

const postgres = new PGlite();
vi.mock("./client", () => ({ db: drizzle(postgres) }));
vi.mock("@/lib/env", () => ({ env: {} }));
const {
  isEveRootTitlePending,
  replaceEveRootFallbackTitle,
  settleEveRootFallbackTitle,
} = await import("@/plugins/ai-titles/title-queries");
const chat = "00000000-0000-4000-8000-000000000001";
const conversation = "00000000-0000-4000-8000-000000000002";
beforeAll(async () => {
  const directory = new URL("migrations/", import.meta.url);
  const entries = await readdir(directory);
  const files = entries.filter((name) => name.endsWith(".sql")).toSorted();
  const migrations = await Promise.all(
    files.map(async (name) => await readFile(new URL(name, directory), "utf-8"))
  );
  await postgres.exec(migrations.join("\n"));
  await postgres.exec(`
    INSERT INTO "user" (id,name,email) VALUES ('owner','owner','owner');
    INSERT INTO "EveChat" (id,"ownerId",title) VALUES ('${chat}','owner','Fallback');
    INSERT INTO "EveWorkspace" (id,"ownerId") VALUES ('${chat}','owner');
    INSERT INTO "EveConversation" ("workspaceId",id,"chatId","ownerId","operationId","firstMessage","sessionId",state)
    VALUES ('${chat}','${conversation}','${chat}','owner','${conversation}','Fallback','session','bound');
  `);
}, 30_000);
afterAll(async () => {
  await postgres.close();
});

test("title enrichment is owner scoped, settles once, and preserves chat recency", async () => {
  const before = await postgres.query('SELECT "updatedAt" FROM "EveChat"');
  expect(await isEveRootTitlePending("other", conversation, "Fallback")).toBe(
    false
  );
  expect(
    await replaceEveRootFallbackTitle("other", conversation, "Fallback", "Leak")
  ).toBe(false);
  expect(await isEveRootTitlePending("owner", conversation, "Fallback")).toBe(
    true
  );
  expect(
    await replaceEveRootFallbackTitle(
      "owner",
      conversation,
      "Fallback",
      "Generated"
    )
  ).toBe(true);
  expect(
    await replaceEveRootFallbackTitle(
      "owner",
      conversation,
      "Fallback",
      "Retry"
    )
  ).toBe(false);
  expect(await postgres.query('SELECT "updatedAt" FROM "EveChat"')).toEqual(
    before
  );
});
test("a manual rename wins against an in-flight title generation even when it matches the fallback", async () => {
  await postgres.exec(
    `UPDATE "EveChat" SET title='Fallback', "titleStatus"='manual'`
  );
  expect(
    await replaceEveRootFallbackTitle(
      "owner",
      conversation,
      "Fallback",
      "Generated"
    )
  ).toBe(false);
  expect(
    await settleEveRootFallbackTitle("owner", conversation, "Fallback")
  ).toBe(false);
});
test("retired conversations cannot start or finish title enrichment", async () => {
  await postgres.exec(
    `UPDATE "EveChat" SET title='Fallback', "titleStatus"='pending'; UPDATE "EveConversation" SET state='deleting'`
  );
  expect(await isEveRootTitlePending("owner", conversation, "Fallback")).toBe(
    false
  );
  expect(
    await replaceEveRootFallbackTitle(
      "owner",
      conversation,
      "Fallback",
      "Generated"
    )
  ).toBe(false);
  expect(
    await settleEveRootFallbackTitle("owner", conversation, "Fallback")
  ).toBe(false);
});
