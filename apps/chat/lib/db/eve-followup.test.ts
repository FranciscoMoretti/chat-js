import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { z } from "zod";

const postgres = new PGlite();
vi.mock("server-only", () => ({}));
vi.mock("./client", () => ({ db: drizzle(postgres) }));
vi.mock("../env", () => ({ env: {} }));
vi.mock("@/lib/eve/persistent-sandbox-store", () => ({
  checkDeletedWorkspaceMemberships: vi
    .fn<() => Promise<void>>()
    .mockResolvedValue(),
}));
const { completeEveConversationDeletion } = await import("./eve-deletion");
const { claimEveFollowup, finishEveFollowup, getEveFollowup } =
  await import("@/plugins/followup-suggestions/followup-queries");
const chatId = "00000000-0000-4000-8000-000000000001";
const branchId = "00000000-0000-4000-8000-000000000002";
beforeAll(async () => {
  const journal = z
    .object({ entries: z.array(z.object({ tag: z.string() })) })
    .parse(
      JSON.parse(
        await readFile(
          new URL("migrations/meta/_journal.json", import.meta.url),
          "utf-8"
        )
      )
    );
  /* oxlint-disable no-await-in-loop -- Schema migrations have ordered dependencies. */
  for (const entry of journal.entries) {
    await postgres.exec(
      await readFile(
        new URL(`migrations/${entry.tag}.sql`, import.meta.url),
        "utf-8"
      )
    );
  }
  /* oxlint-enable no-await-in-loop */
  await postgres.exec(`
    INSERT INTO "user" (id, name, email) VALUES ('owner', 'owner', 'owner');
    INSERT INTO "EveChat" (id, "ownerId", title) VALUES ('${chatId}', 'owner', 'Test');
    INSERT INTO "EveWorkspace" (id, "ownerId") VALUES ('${chatId}', 'owner');
    INSERT INTO "EveConversation" ("workspaceId", id, "chatId", "ownerId", "operationId", "firstMessage", "sessionId", state)
    VALUES ('${chatId}', '${chatId}', '${chatId}', 'owner', '${chatId}', 'Test', 'root', 'bound'),
      ('${chatId}', '${branchId}', '${chatId}', 'owner', '${branchId}', 'Test', 'branch', 'bound');
  `);
}, 30_000);
afterAll(async () => {
  await postgres.close();
});

it("admits one generation across concurrent completion callbacks and replay", async () => {
  const claims = await Promise.all([
    claimEveFollowup("owner", "root", "turn", "completion"),
    claimEveFollowup("owner", "root", "turn", "completion"),
  ]);
  expect(claims.filter(Boolean)).toEqual([chatId]);
  expect(
    await claimEveFollowup("owner", "root", "turn", "completion")
  ).toBeNull();
  expect(await getEveFollowup("owner", chatId, "completion")).toBeNull();
});
it("persists exact-turn output for reload and native branches, isolated by owner", async () => {
  await finishEveFollowup("owner", chatId, "completion", [
    "Next?",
    "Why?",
    "How?",
  ]);
  expect(await getEveFollowup("owner", branchId, "completion")).toEqual([
    "Next?",
    "Why?",
    "How?",
  ]);
  expect(await getEveFollowup("foreign", branchId, "completion")).toBeNull();
  expect(await getEveFollowup("owner", branchId, "other-turn")).toBeNull();
  expect(
    await claimEveFollowup(
      "foreign",
      "root",
      "foreign-turn",
      "foreign-completion"
    )
  ).toBeNull();
  expect(
    await claimEveFollowup(
      "owner",
      "unknown",
      "unknown-turn",
      "unknown-completion"
    )
  ).toBeNull();
});
it("does not collide when another branch reuses a turn number", async () => {
  expect(
    await claimEveFollowup("owner", "branch", "turn", "branch-completion")
  ).toBe(chatId);
  await finishEveFollowup("owner", chatId, "branch-completion", [
    "Branch next?",
  ]);
  expect(await getEveFollowup("owner", branchId, "branch-completion")).toEqual([
    "Branch next?",
  ]);
  expect(await getEveFollowup("owner", branchId, "completion")).toEqual([
    "Next?",
    "Why?",
    "How?",
  ]);
});
it("cleans only deleted-session suggestions when the logical chat survives", async () => {
  await postgres.exec(
    `UPDATE "EveConversation" SET state='deleting' WHERE id='${branchId}'`
  );
  await completeEveConversationDeletion("owner", branchId);
  expect(await getEveFollowup("owner", chatId, "branch-completion")).toBeNull();
  const afterDeletion = await postgres.query(
    'SELECT * FROM "EveFollowup" WHERE "eventId" = $1',
    ["branch-completion"]
  );
  expect(afterDeletion.rows).toEqual([]);
  expect(await getEveFollowup("owner", chatId, "completion")).toEqual([
    "Next?",
    "Why?",
    "How?",
  ]);
  await finishEveFollowup("owner", chatId, "branch-completion", [
    "Late result",
  ]);
  expect(await getEveFollowup("owner", chatId, "branch-completion")).toBeNull();
  const afterLateFinish = await postgres.query(
    'SELECT * FROM "EveFollowup" WHERE "eventId" = $1',
    ["branch-completion"]
  );
  expect(afterLateFinish.rows).toEqual([]);
});
it("fences new claims and reads after deletion begins", async () => {
  await postgres.exec(
    `UPDATE "EveConversation" SET state = 'deleting' WHERE "chatId" = '${chatId}'`
  );
  expect(
    await claimEveFollowup(
      "owner",
      "root",
      "after-delete",
      "deleted-completion"
    )
  ).toBeNull();
  expect(await getEveFollowup("owner", chatId, "completion")).toBeNull();
});
