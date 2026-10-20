import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { z } from "zod";

import { PGlite } from "@electric-sql/pglite";
import type { SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

const DATABASE_SETUP_TIMEOUT_MS = 30_000;
const postgres = new PGlite();
const mocks = vi.hoisted(() => ({
  execute:
    vi.fn<(query: ReadonlyNativeSurface<SQL>) => Promise<readonly unknown[]>>(),
}));
vi.mock(
  "./client",
  (): {
    db: {
      execute: (
        query: ReadonlyNativeSurface<SQL>
      ) => Promise<readonly unknown[]>;
      transaction: ReturnType<typeof drizzle>["transaction"];
    };
  } => {
    const database = drizzle(postgres);
    mocks.execute.mockImplementation(async (query) => {
      const result = await database.execute(query);
      return result.rows;
    });
    return {
      db: {
        execute: mocks.execute,
        transaction: database.transaction.bind(database),
      },
    };
  }
);
vi.mock("@/lib/env", () => ({ env: {} }));

const { eveEventSearchText } = await import("../eve/search-text");
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
  const migrations = await Promise.all(
    journal.entries.map(
      async ({ tag }) =>
        await readFile(
          new URL(`migrations/${tag}.sql`, import.meta.url),
          "utf-8"
        )
    )
  );
  for (const migration of migrations) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Apply ordered schema/history migrations and create each chat before its conversation foreign-key row; preview repair depends on the exact retained migration journal.
    await postgres.exec(migration);
  }
  await postgres.exec(
    `insert into "user" (id, name, email) values ('alice', 'Alice', 'alice@example.test'), ('bob', 'Bob', 'bob@example.test')`
  );
  await postgres.query(
    `insert into "EveChat" (id, "ownerId", title) values ($1, 'alice', 'Weekend notes'), ($2, 'alice', 'Saffron cooking'), ($3, 'bob', 'Private saffron')`,
    [chat, titleChat, otherChat]
  );
  await postgres.exec(
    'insert into "EveWorkspace" (id,"ownerId") select id,"ownerId" from "EveChat" on conflict do nothing'
  );
  await postgres.query(
    `insert into "EveConversation" ("workspaceId", id, "chatId", "ownerId", "firstMessage", "operationId", "sessionId", state) values ($2, $1::uuid, $2, 'alice', '', $1::uuid, $1::text, 'bound'), ($4, $3::uuid, $4, 'alice', '', $3::uuid, $3::text, 'bound'), ($6, $5::uuid, $6, 'bob', '', $5::uuid, $5::text, 'bound')`,
    [branch, chat, titleBranch, titleChat, otherBranch, otherChat]
  );
}, DATABASE_SETUP_TIMEOUT_MS);
afterAll(async () => {
  await postgres.close();
});

it("rejects malformed database rows before returning search results or cursors", async () => {
  mocks.execute.mockResolvedValueOnce([
    {
      conversationId: branch,
      excerpt: "Try saffron in the rice.",
      highlightQuery: "'saffron'",
      highlightWords: {},
      id: chat,
      rank: "invalid",
      title: "Weekend notes",
      updatedAt: "2026-10-13T00:00:00.000000Z",
    },
  ]);
  await expect(
    searchEveConversations("alice", { search: "saffron" })
  ).rejects.toThrow("rank");
});

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
  async (search: string, ids: readonly string[]) => {
    const result = await searchEveConversations("alice", { search });
    expect(result.items.map((item) => item.id)).toEqual(ids);
    if (search === "saffron ri") {
      expect(result.items[0].excerpt).toContain("⟦ri⟧ce");
    }
  }
);

it("keeps the title boost while selecting the branch and excerpt with matching text", async () => {
  const matchingBranch = "00000000-0000-4000-8000-000000000007";
  await postgres.exec(
    'insert into "EveWorkspace" (id,"ownerId") select id,"ownerId" from "EveChat" on conflict do nothing'
  );
  await postgres.query(
    `insert into "EveConversation" ("workspaceId", id, "chatId", "ownerId", "firstMessage", "operationId", "sessionId", state)
     values ($2, $1::uuid, $2, 'alice', '', $1::uuid, $1::text, 'bound')`,
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

it("continues past tied ranks and timestamps without skipping when an earlier result disappears", async () => {
  await postgres.exec(`
    insert into "user" (id, name, email) values ('pager', 'Pager', 'pager@example.test');
    insert into "EveChat" (id, "ownerId", title, "updatedAt")
      select md5(i::text)::uuid, 'pager', 'Pagination test', '2026-09-25 10:00:00.123456'::timestamp
      from generate_series(1, 25) i;
    insert into "EveWorkspace" (id,"ownerId") select id,"ownerId" from "EveChat" on conflict do nothing;
    insert into "EveConversation" ("workspaceId", id, "chatId", "ownerId", "firstMessage", "operationId", "sessionId", state)
      select id, id, id, 'pager', '', id, id::text, 'bound' from "EveChat" where "ownerId" = 'pager';
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

it("blocks deletion for retained document revisions only within the requested family", async () => {
  const deletingChat = crypto.randomUUID();
  const deletingConversation = crypto.randomUUID();
  const unrelatedChat = crypto.randomUUID();
  const unrelatedConversation = crypto.randomUUID();
  await postgres.query(
    `insert into "EveChat" (id, "ownerId", title) values ($1, 'alice', 'Delete me'), ($2, 'alice', 'Keep me')`,
    [deletingChat, unrelatedChat]
  );
  await postgres.exec(
    'insert into "EveWorkspace" (id,"ownerId") select id,"ownerId" from "EveChat" on conflict do nothing'
  );
  await postgres.query(
    `insert into "EveConversation" ("workspaceId", id, "chatId", "ownerId", "firstMessage", "operationId", state) values ($2, $1, $2, 'alice', 'Delete me', $1, 'deleting'), ($4, $3, $4, 'alice', 'Keep me', $3, 'bound')`,
    [deletingConversation, deletingChat, unrelatedConversation, unrelatedChat]
  );
  await postgres.query(
    `insert into "EveDocumentRevision" ("conversationId", "documentId", "ownerId", "operationId", content, kind, title) values ($1, $2, 'alice', 'retain', 'Private payload', 'text', 'Retained'), ($3, $4, 'alice', 'unrelated', 'Other payload', 'text', 'Unrelated')`,
    [
      deletingConversation,
      crypto.randomUUID(),
      unrelatedConversation,
      crypto.randomUUID(),
    ]
  );
  await expect(
    completeEveConversationDeletion("alice", deletingChat)
  ).rejects.toThrow("Application content cleanup is incomplete.");
  const pending = await postgres.query<{ state: string }>(
    `select state from "EveConversation" where id = $1`,
    [deletingConversation]
  );
  expect(pending.rows[0].state).toBe("deleting");
  await postgres.query(
    `delete from "EveDocumentRevision" where "conversationId" = $1`,
    [deletingConversation]
  );
  await completeEveConversationDeletion("alice", deletingChat);
  const finalized = await postgres.query<{
    state: string;
    firstMessage: string;
  }>(`select state, "firstMessage" from "EveConversation" where id = $1`, [
    deletingConversation,
  ]);
  expect(finalized.rows[0]).toEqual({ firstMessage: "", state: "deleted" });
  const unrelated = await postgres.query<{ content: string }>(
    `select content from "EveDocumentRevision" where "conversationId" = $1`,
    [unrelatedConversation]
  );
  expect(unrelated.rows).toEqual([{ content: "Other payload" }]);
});

const repairPreviewSearchHistory = async (
  preview: Readonly<Pick<PGlite, "exec" | "query">>
): Promise<void> => {
  await preview.exec(`
      create schema drizzle;
      create table drizzle.__drizzle_migrations (hash text not null, created_at bigint not null);
      create table "EveSearchText" (text text);
      create table "EveChat" (title text);
      insert into "EveChat" values ('Retained conversation');
    `);
  const [baseline, nextMigration] = await Promise.all([
    readFile(new URL("migrations/0000_eve_baseline.sql", import.meta.url)),
    readFile(
      new URL("migrations/0001_brainy_the_stranger.sql", import.meta.url)
    ),
  ]);
  await preview.query(
    "insert into drizzle.__drizzle_migrations values ($1, $2), ($3, $4)",
    [
      createHash("sha256").update(baseline).digest("hex"),
      1_789_411_557_764,
      createHash("sha256").update(nextMigration).digest("hex"),
      1_789_979_176_755,
    ]
  );
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
};

describe("preview search history", (): void => {
  const preview = new PGlite();

  // WASM database startup belongs to fixture setup; keep the repair assertions
  // under Vitest's normal test timeout, just like the other database cases.
  beforeAll(async (): Promise<void> => {
    await preview.waitReady;
  }, DATABASE_SETUP_TIMEOUT_MS);
  afterAll(async (): Promise<void> => {
    await preview.close();
  });
  it("repairs only the known unpublished preview history and preserves conversation data", async (): Promise<void> => {
    await repairPreviewSearchHistory(preview);
  });
});

vi.mock("@/lib/eve/persistent-sandbox-store", () => ({
  checkDeletedWorkspaceMemberships: vi
    .fn<() => Promise<void>>()
    .mockResolvedValue(),
}));
