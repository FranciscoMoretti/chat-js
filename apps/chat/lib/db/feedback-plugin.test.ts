import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, expect, test, vi } from "vitest";

const postgres = new PGlite();
vi.mock("./client", () => ({ db: drizzle(postgres) }));
vi.mock("@/lib/env", () => ({ env: {} }));
vi.mock("@/lib/eve/persistent-sandbox-store", () => ({
  checkDeletedWorkspaceMemberships: vi
    .fn<() => Promise<void>>()
    .mockResolvedValue(),
}));
const { getEveMessageVotes, saveEveMessageVote } =
  await import("@/plugins/feedback/feedback-queries");
const { completeEveConversationDeletion } = await import("./eve-deletion");
const chatId = "00000000-0000-4000-8000-000000000001";
const branchId = "00000000-0000-4000-8000-000000000002";

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
    INSERT INTO "EveChat" (id,"ownerId",title) VALUES ('${chatId}','owner','Test');
    INSERT INTO "EveWorkspace" (id,"ownerId") VALUES ('${chatId}','owner');
    INSERT INTO "EveConversation" ("workspaceId",id,"chatId","ownerId","operationId","firstMessage","sessionId",state)
    VALUES ('${chatId}','${chatId}','${chatId}','owner','${chatId}','Test','root','bound'),
      ('${chatId}','${branchId}','${chatId}','owner','${branchId}','Test','branch','bound');
  `);
}, 30_000);
afterAll(async () => {
  await postgres.close();
});

test("votes keep exact conversation identity and never reorder the logical chat", async () => {
  const before = await postgres.query('SELECT "updatedAt" FROM "EveChat"');
  expect(
    await saveEveMessageVote("owner", chatId, "same-message", true)
  ).toEqual({
    messageId: "same-message",
    isUpvoted: true,
  });
  await saveEveMessageVote("owner", branchId, "same-message", false);
  expect(await getEveMessageVotes("owner", chatId)).toEqual([
    { messageId: "same-message", isUpvoted: true },
  ]);
  expect(await getEveMessageVotes("owner", branchId)).toEqual([
    { messageId: "same-message", isUpvoted: false },
  ]);
  expect(await postgres.query('SELECT "updatedAt" FROM "EveChat"')).toEqual(
    before
  );
});
test("reads and writes require the owner and a currently bound conversation", async () => {
  expect(
    await saveEveMessageVote("foreign", branchId, "same-message", true)
  ).toBeNull();
  expect(await getEveMessageVotes("foreign", branchId)).toEqual([]);
  await postgres.exec(
    `UPDATE "EveConversation" SET state='deleting' WHERE id='${branchId}'`
  );
  expect(
    await saveEveMessageVote("owner", branchId, "same-message", true)
  ).toBeNull();
  expect(await getEveMessageVotes("owner", branchId)).toEqual([]);
});
test("deleting one branch cleans its votes while preserving the surviving chat and its votes", async () => {
  await completeEveConversationDeletion("owner", branchId);
  const votes = await postgres.query('SELECT "conversationId" FROM "EveVote"');
  expect(votes.rows).toEqual([{ conversationId: chatId }]);
  expect(await getEveMessageVotes("owner", chatId)).toHaveLength(1);
  const branch = await postgres.query(
    `SELECT state FROM "EveConversation" WHERE id='${branchId}'`
  );
  expect(branch.rows).toEqual([{ state: "deleted" }]);
});
