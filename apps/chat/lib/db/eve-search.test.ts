/* oxlint-disable eslint/no-await-in-loop -- Ordered migrations and fixtures exercise the real schema. */
import { readFile } from "node:fs/promises";

import { PGlite } from "@electric-sql/pglite";
import type { SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

const postgres = new PGlite();
vi.mock("./client", () => {
  const database = drizzle(postgres);
  return {
    db: {
      execute: async (query: SQL) => {
        const result = await database.execute(query);
        return result.rows;
      },
      transaction: database.transaction.bind(database),
    },
  };
});
vi.mock("@/lib/env", () => ({ env: {} }));

const { indexEveSearchText, searchEveConversations } =
  await import("./eve-search");
const { completeEveConversationDeletion } = await import("./eve-deletion");
const chat = "00000000-0000-4000-8000-000000000001";
const branch = "00000000-0000-4000-8000-000000000002";
const titleChat = "00000000-0000-4000-8000-000000000003";
const titleBranch = "00000000-0000-4000-8000-000000000004";
const otherChat = "00000000-0000-4000-8000-000000000005";
const otherBranch = "00000000-0000-4000-8000-000000000006";

beforeAll(async () => {
  for (const filename of [
    "0000_eve_baseline.sql",
    "0001_brainy_the_stranger.sql",
    "0002_opposite_firelord.sql",
  ]) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Apply the real migrations in sequence.
    await postgres.exec(
      await readFile(
        new URL(`migrations/${filename}`, import.meta.url),
        "utf-8"
      )
    );
  }
  await postgres.exec(
    `insert into "user" (id, name, email) values ('alice', 'Alice', 'alice@example.test'), ('bob', 'Bob', 'bob@example.test')`
  );
  for (const [id, conversationId, ownerId, title] of [
    [chat, branch, "alice", "Weekend notes"],
    [titleChat, titleBranch, "alice", "Saffron cooking"],
    [otherChat, otherBranch, "bob", "Private saffron"],
  ]) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Seed each owned chat and its binding.
    await postgres.query(
      `insert into "EveChat" (id, "ownerId", title) values ($1, $2, $3)`,
      [id, ownerId, title]
    );
    // oxlint-disable-next-line eslint/no-await-in-loop -- Seed each owned chat and its binding.
    await postgres.query(
      `insert into "EveConversation" (id, "chatId", "ownerId", "firstMessage", "operationId", "sessionId", state) values ($1::uuid, $2, $3, '', $1::uuid, $1::text, 'bound')`,
      [conversationId, id, ownerId]
    );
  }
}, 30_000);
afterAll(() => postgres.close());

it("finds message-only matches, boosts titles, highlights excerpts and deduplicates chats", async () => {
  await indexEveSearchText("alice", branch, [
    { key: "user", text: "Try saffron in the rice." },
    { key: "assistant", text: "Toast the saffron gently before adding broth." },
  ]);
  await indexEveSearchText("alice", branch, [
    { key: "user", text: "Try saffron in the rice." },
  ]);
  await indexEveSearchText("bob", otherBranch, [
    { key: "secret", text: "saffron private recipe" },
  ]);
  const result = await searchEveConversations("alice", { search: "saffron" });
  expect(result.items.map((item) => item.id)).toEqual([titleChat, chat]);
  expect(result.items[1]).toMatchObject({ conversationId: branch });
  expect(result.items[1].excerpt).toContain("⟦saffron⟧");
  const count = await postgres.query<{ count: number }>(
    `select count(*)::int as count from "EveSearchText" where "conversationId" = $1`,
    [branch]
  );
  expect(count.rows[0].count).toBe(2);
});

it("rejects cross-owner indexing and handles punctuation-only searches", async () => {
  await indexEveSearchText("bob", branch, [
    { key: "attack", text: "leakword" },
  ]);
  const denied = await searchEveConversations("alice", { search: "leakword" });
  expect(denied.items).toEqual([]);
  const punctuation = await searchEveConversations("alice", { search: "!!!" });
  expect(punctuation.items).toEqual([]);
});

it.each([
  ["saff", [titleChat, chat]],
  ["SAFF", [titleChat, chat]],
  ["saffron coo", [titleChat]],
  ["saff cook", []],
  ["affron", []],
  ['"saff"', []],
  ['"saffron coo"', []],
  ['"saff', []],
  ["saffron -coo", [titleChat, chat]],
  ["saffron -cooking", [chat]],
  ["unknown OR coo", [titleChat]],
  ["saffron ri", [chat]],
  ["!!!", []],
  ["' | & :*", []],
])(
  "matches the last positive unquoted word as a prefix: %s",
  async (search, ids) => {
    const result = await searchEveConversations("alice", { search });
    expect(result.items.map((item) => item.id)).toEqual(ids);
    if (search === "saffron ri") {
      expect(result.items[0].excerpt).toContain("⟦rice⟧");
    }
  }
);

it("hides deleting chats and permanently erases text without allowing a late backfill", async () => {
  await postgres.query(
    `update "EveConversation" set state = 'deleting' where id = $1`,
    [branch]
  );
  const visible = await searchEveConversations("alice", { search: "saffron" });
  expect(visible.items.map((item) => item.id)).toEqual([titleChat]);
  await completeEveConversationDeletion("alice", chat);
  await indexEveSearchText("alice", branch, [{ key: "late", text: "saffron" }]);
  const count = await postgres.query<{ count: number }>(
    `select count(*)::int as count from "EveSearchText" where "conversationId" = $1`,
    [branch]
  );
  expect(count.rows[0].count).toBe(0);
});
