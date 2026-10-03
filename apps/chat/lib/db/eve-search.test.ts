/* oxlint-disable import/no-nodejs-modules, sort-imports --
 * import/no-nodejs-modules (#529): This test harness requires import { createHash } from "node:crypto";; import { readFile } from "node:fs/promises";; its Node runtime boundary deliberately permits these built-ins.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
/* oxlint-disable eslint/no-await-in-loop -- Ordered migrations and fixtures exercise the real schema. */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { PGlite } from "@electric-sql/pglite";
import type { SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
/* oxlint-enable import/no-nodejs-modules, sort-imports */

const postgres = new PGlite();
/* oxlint-disable oxc/no-async-await, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types --
 * oxc/no-async-await (#540): vi.mock("./client") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep vi.mock("./client")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): vi.mock("./client") accepts query: SQL; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable oxc/no-async-await, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types */
vi.mock("@/lib/env", () => ({ env: {} }));

/* oxlint-disable import/no-relative-parent-imports, node/no-top-level-await --
 * import/no-relative-parent-imports (#530): Keep the explicit "../eve/search-text" dependency within this package instead of introducing an alias or barrel API.
 * node/no-top-level-await (#539): { eveEventSearchText } runs in the configured Bun/ESM entrypoint and must finish before following module work; do not introduce background initialization.
 */
const { eveEventSearchText } = await import("../eve/search-text");
/* oxlint-enable import/no-relative-parent-imports, node/no-top-level-await */
/* oxlint-disable node/no-top-level-await --
 * node/no-top-level-await (#539): { indexEveSearchText, searchEveConversations } runs in the configured Bun/ESM entrypoint and must finish before following module work; do not introduce background initialization.
 */
const { indexEveSearchText, searchEveConversations } =
  await import("./eve-search");
/* oxlint-enable node/no-top-level-await */
/* oxlint-disable node/no-top-level-await --
 * node/no-top-level-await (#539): { completeEveConversationDeletion } runs in the configured Bun/ESM entrypoint and must finish before following module work; do not introduce background initialization.
 */
const { completeEveConversationDeletion } = await import("./eve-deletion");
/* oxlint-enable node/no-top-level-await */
const chat = "00000000-0000-4000-8000-000000000001";
const branch = "00000000-0000-4000-8000-000000000002";
const titleChat = "00000000-0000-4000-8000-000000000003";
const titleBranch = "00000000-0000-4000-8000-000000000004";
const otherChat = "00000000-0000-4000-8000-000000000005";
const otherBranch = "00000000-0000-4000-8000-000000000006";

/* oxlint-disable no-magic-numbers, oxc/no-async-await --
 * no-magic-numbers (#517): beforeAll uses 30_000 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): beforeAll sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
beforeAll(async () => {
  for (const filename of [
    "0000_eve_baseline.sql",
    "0001_brainy_the_stranger.sql",
    "0002_nappy_caretaker.sql",
    "0003_ambitious_oracle.sql",
    "0004_misty_next_avengers.sql",
    "0005_managed_workflow_safeguards.sql",
    "0006_unpriced_usage_index.sql",
    "0007_kind_charles_xavier.sql",
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
/* oxlint-enable no-magic-numbers, oxc/no-async-await */
/* oxlint-disable typescript/promise-function-async --
 * typescript/promise-function-async (#606): afterAll preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
afterAll(() => postgres.close());
/* oxlint-enable typescript/promise-function-async */

/* oxlint-disable no-magic-numbers, oxc/no-async-await, typescript/prefer-readonly-parameter-types --
 * no-magic-numbers (#517): it("finds message-only matches, boosts titles, highlights excerpts and deduplicates c uses 1, 0, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): it("finds message-only matches, boosts titles, highlights excerpts and deduplicates c sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): it("finds message-only matches, boosts titles, highlights excerpts and deduplicates c accepts item; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable no-magic-numbers, oxc/no-async-await, typescript/prefer-readonly-parameter-types */

/* oxlint-disable oxc/no-async-await --
 * oxc/no-async-await (#540): it("rejects cross-owner indexing and handles punctuation-only searches") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
it("rejects cross-owner indexing and handles punctuation-only searches", async () => {
  await indexEveSearchText("bob", branch, [
    { key: "attack", text: "leakword" },
  ]);
  const denied = await searchEveConversations("alice", { search: "leakword" });
  expect(denied.items).toEqual([]);
  const punctuation = await searchEveConversations("alice", { search: "!!!" });
  expect(punctuation.items).toEqual([]);
});
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable no-magic-numbers, oxc/no-async-await, typescript/prefer-readonly-parameter-types --
 * no-magic-numbers (#517): it.each([ ["saff", [titleChat, chat]], ["SAFF", [titleChat, chat]], ["saffron coo", [ uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): it.each([ ["saff", [titleChat, chat]], ["SAFF", [titleChat, chat]], ["saffron coo", [ sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): it.each([ ["saff", [titleChat, chat]], ["SAFF", [titleChat, chat]], ["saffron coo", [ accepts ids; item; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
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
      expect(result.items[0].excerpt).toContain("⟦ri⟧ce");
    }
  }
);
/* oxlint-enable no-magic-numbers, oxc/no-async-await, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers, oxc/no-async-await --
 * no-magic-numbers (#517): it("keeps the title boost while selecting the branch and excerpt with matching text") uses 0, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): it("keeps the title boost while selecting the branch and excerpt with matching text") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
it("keeps the title boost while selecting the branch and excerpt with matching text", async () => {
  const matchingBranch = "00000000-0000-4000-8000-000000000007";
  await postgres.query(
    `insert into "EveConversation" (id, "chatId", "ownerId", "firstMessage", "operationId", "sessionId", state)
     values ($1::uuid, $2, 'alice', '', $1::uuid, $1::text, 'bound')`,
    [matchingBranch, titleChat]
  );
  await indexEveSearchText("alice", matchingBranch, [
    { key: "matching", text: "Saffron cooking with rice." },
  ]);
  const result = await searchEveConversations("alice", { search: "saff" });
  expect(result.items[0]).toMatchObject({
    conversationId: matchingBranch,
    id: titleChat,
  });
  expect(result.items[0].rank).toBeGreaterThan(2);
  expect(result.items[0].excerpt).toContain("⟦Saff⟧ron");
});
/* oxlint-enable no-magic-numbers, oxc/no-async-await */

/* oxlint-disable oxc/no-async-await, typescript/prefer-readonly-parameter-types --
 * oxc/no-async-await (#540): it.each([ ["SAFF", "⟦Saff⟧ron"], ["saffron OR saff", "⟦Saffron⟧"], ['"saffron cooking sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): it.each([ ["SAFF", "⟦Saff⟧ron"], ["saffron OR saff", "⟦Saffron⟧"], ['"saffron cooking accepts item; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
it.each([
  ["SAFF", "⟦Saff⟧ron"],
  ["saffron OR saff", "⟦Saffron⟧"],
  ['"saffron cooking"', "⟦Saffron⟧ ⟦cooking⟧"],
  ["saffron -rice", "⟦saffron⟧"],
])(
  "preserves full matches and query syntax when highlighting %s",
  async (search, excerpt) => {
    const result = await searchEveConversations("alice", { search });
    expect(result.items.some((item) => item.excerpt.includes(excerpt))).toBe(
      true
    );
  }
);
/* oxlint-enable oxc/no-async-await, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers, oxc/no-async-await --
 * no-magic-numbers (#517): it("shows an assistant-only Hello match even when the title also matches") uses 1, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): it("shows an assistant-only Hello match even when the title also matches") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
it("shows an assistant-only Hello match even when the title also matches", async () => {
  await postgres.query(
    `update "EveChat" set title = 'Friendly Hello Chat' where id = $1`,
    [titleChat]
  );
  await indexEveSearchText(
    "alice",
    titleBranch,
    eveEventSearchText({
      data: {
        finishReason: "stop",
        message: "Hello! How can I help you today?",
        sequence: 1,
        stepIndex: 0,
        turnId: "turn_0",
      },
      meta: { at: "2026-09-26T10:00:00Z", id: "hello-assistant" },
      type: "message.completed",
    })
  );
  const result = await searchEveConversations("alice", { search: "hello" });
  expect(result.items).toHaveLength(1);
  expect(result.items[0]).toMatchObject({
    conversationId: titleBranch,
    id: titleChat,
  });
  expect(result.items[0].excerpt).toContain("⟦Hello⟧");
  await postgres.query(
    `update "EveChat" set title = 'Saffron cooking' where id = $1`,
    [titleChat]
  );
});
/* oxlint-enable no-magic-numbers, oxc/no-async-await */

/* oxlint-disable oxc/no-async-await, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types --
 * oxc/no-async-await (#540): it.each([ ['-"bar baz" ba', "bar ba baz baalone", "⟦ba⟧r ⟦ba⟧ ⟦ba⟧z ⟦ba⟧alone"], ["is sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): it.each([ ['-"bar baz" ba', "bar ba baz baalone", "⟦ba⟧r ⟦ba⟧ ⟦ba⟧z ⟦ba⟧alone"], ["is handles optional result.items.find((item) => item.id === chat)?.excerpt without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/prefer-readonly-parameter-types (#565): it.each([ ['-"bar baz" ba', "bar ba baz baalone", "⟦ba⟧r ⟦ba⟧ ⟦ba⟧z ⟦ba⟧alone"], ["is accepts item; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
it.each([
  ['-"bar baz" ba', "bar ba baz baalone", "⟦ba⟧r ⟦ba⟧ ⟦ba⟧z ⟦ba⟧alone"],
  ["istan", "İstanbul", "⟦İstan⟧bul"],
])(
  "uses positive operands and database case mapping for %s",
  async (search, text, excerpt) => {
    await indexEveSearchText("alice", branch, [
      { key: `highlight:${search}`, text },
    ]);
    const result = await searchEveConversations("alice", { search });
    expect(result.items.find((item) => item.id === chat)?.excerpt).toContain(
      excerpt
    );
  }
);
/* oxlint-enable oxc/no-async-await, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers, oxc/no-async-await, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types --
 * no-magic-numbers (#517): it("continues past tied ranks and timestamps without skipping when an earlier result  uses 20, 0, 5, 25 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): it("continues past tied ranks and timestamps without skipping when an earlier result  sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): it("continues past tied ranks and timestamps without skipping when an earlier result  handles optional first.nextCursor?.updatedAt without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/prefer-readonly-parameter-types (#565): it("continues past tied ranks and timestamps without skipping when an earlier result  accepts item; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
it("continues past tied ranks and timestamps without skipping when an earlier result disappears", async () => {
  await postgres.exec(`
    insert into "user" (id, name, email) values ('pager', 'Pager', 'pager@example.test');
    insert into "EveChat" (id, "ownerId", title, "updatedAt")
      select md5(i::text)::uuid, 'pager', 'Pagination test', '2026-09-25 10:00:00.123456'::timestamp
      from generate_series(1, 25) i;
    insert into "EveConversation" (id, "chatId", "ownerId", "firstMessage", "operationId", "sessionId", state)
      select id, id, 'pager', '', id, id::text, 'bound' from "EveChat" where "ownerId" = 'pager';
  `);
  const first = await searchEveConversations("pager", { search: "pagin" });
  expect(first.items).toHaveLength(20);
  expect(first.nextCursor?.updatedAt).toBe("2026-09-25T10:00:00.123456Z");
  await postgres.query(
    `update "EveConversation" set state = 'deleting' where "chatId" = $1`,
    [first.items[0].id]
  );
  const second = await searchEveConversations("pager", {
    cursor: first.nextCursor,
    search: "pagin",
  });
  expect(second.items).toHaveLength(5);
  expect(second.nextCursor).toBeNull();
  expect(
    new Set([...first.items, ...second.items].map((item) => item.id)).size
  ).toBe(25);
});
/* oxlint-enable no-magic-numbers, oxc/no-async-await, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers, oxc/no-async-await, typescript/prefer-readonly-parameter-types --
 * no-magic-numbers (#517): it("finds a maximum-length quoted phrase crossing a chunk boundary") uses 48, 2, 255, 1999, 0, 8200 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): it("finds a maximum-length quoted phrase crossing a chunk boundary") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): it("finds a maximum-length quoted phrase crossing a chunk boundary") accepts item; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
it("finds a maximum-length quoted phrase crossing a chunk boundary", async () => {
  const phrase = `start ${"word ".repeat(48)}endingz`;
  expect(phrase.length + 2).toBe(255);
  const text = "pad ".repeat(1999) + phrase;
  // Simulate the shorter chunks written by the initial preview, then backfill.
  await indexEveSearchText("alice", branch, [
    { key: "boundary", text: text.slice(0, 8200) },
  ]);
  const before = await searchEveConversations("alice", {
    search: `"${phrase}"`,
  });
  expect(before.items).toEqual([]);
  await indexEveSearchText("alice", branch, [{ key: "boundary", text }]);
  const result = await searchEveConversations("alice", {
    search: `"${phrase}"`,
  });
  expect(result.items.map((item) => item.id)).toEqual([chat]);
});
/* oxlint-enable no-magic-numbers, oxc/no-async-await, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers, oxc/no-async-await, typescript/prefer-readonly-parameter-types --
 * no-magic-numbers (#517): it("hides deleting chats and permanently erases text without allowing a late backfill uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): it("hides deleting chats and permanently erases text without allowing a late backfill sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): it("hides deleting chats and permanently erases text without allowing a late backfill accepts item; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable no-magic-numbers, oxc/no-async-await, typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, oxc/no-async-await, unicorn/no-null --
 * max-lines-per-function (#510): it("repairs only the known unpublished preview history and preserves conversation dat keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): it("repairs only the known unpublished preview history and preserves conversation dat keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): it("repairs only the known unpublished preview history and preserves conversation dat uses 1_789_411_557_764, 1_789_979_176_755, 1_790_327_870_855, 3, 0, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): it("repairs only the known unpublished preview history and preserves conversation dat sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * unicorn/no-null (#570): it("repairs only the known unpublished preview history and preserves conversation dat preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
it("repairs only the known unpublished preview history and preserves conversation data", async () => {
  const preview = new PGlite();
  try {
    await preview.exec(`
      create schema drizzle;
      create table drizzle.__drizzle_migrations (hash text not null, created_at bigint not null);
      create table "EveSearchText" (text text);
      create table "EveChat" (title text);
      insert into "EveChat" values ('Retained conversation');
    `);
    for (const [file, at] of [
      ["0000_eve_baseline.sql", 1_789_411_557_764],
      ["0001_brainy_the_stranger.sql", 1_789_979_176_755],
    ] as const) {
      const hash = createHash("sha256")
        .update(await readFile(new URL(`migrations/${file}`, import.meta.url)))
        .digest("hex");
      await preview.query(
        "insert into drizzle.__drizzle_migrations values ($1, $2)",
        [hash, at]
      );
    }
    const repair = await readFile(
      new URL("../../scripts/repair-search-preview.sql", import.meta.url),
      "utf-8"
    );
    await preview.query(
      "insert into drizzle.__drizzle_migrations values ($1, $2)",
      ["unrecognized", 1_790_327_870_855]
    );
    await expect(preview.exec(repair)).rejects.toThrow("Not the known");
    await preview.exec("rollback");
    const rejectedHistory = await preview.query(
      "select * from drizzle.__drizzle_migrations"
    );
    expect(rejectedHistory.rows).toHaveLength(3);
    const retainedTable = await preview.query(
      "select to_regclass('public.\"EveSearchText\"') as table_name"
    );
    expect(retainedTable.rows[0]).toMatchObject({
      table_name: '"EveSearchText"',
    });
    await preview.query(
      "update drizzle.__drizzle_migrations set hash = $1 where created_at = $2",
      [
        "7e6be9466a37bdfe7d71ed3ccfbae93c26e50b31f80314b49a2ad298c6f6ab60",
        1_790_327_870_855,
      ]
    );
    await preview.exec(repair);
    const repairedHistory = await preview.query(
      "select * from drizzle.__drizzle_migrations"
    );
    expect(repairedHistory.rows).toHaveLength(2);
    const retainedChats = await preview.query('select * from "EveChat"');
    expect(retainedChats.rows).toEqual([{ title: "Retained conversation" }]);
    const removedTable = await preview.query(
      "select to_regclass('public.\"EveSearchText\"') as table_name"
    );
    expect(removedTable.rows[0]).toMatchObject({ table_name: null });
  } finally {
    await preview.close();
  }
});
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, oxc/no-async-await, unicorn/no-null */

/* oxlint-disable max-lines -- #509: This eve-search.test.ts module keeps its existing fixture/scenario boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric. */
