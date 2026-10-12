import { readFile } from "node:fs/promises";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { MessageStreamEvent } from "eve/client";
import { afterAll, beforeAll, expect, expectTypeOf, it, vi } from "vitest";
import { z } from "zod";

const postgres = new PGlite();
vi.mock("./client", () => ({ db: drizzle(postgres) }));
vi.mock("../env", () => ({ env: {} }));
const {
  registerEveSubagent,
  getEveSubagent,
  advanceEveSubagentUsageCursor,
  listEveSubagents,
} = await import("./eve-subagents");
const { ingestEveUsage } = await import("../eve/usage");
const conversationId = "00000000-0000-4000-8000-000000000001";
const otherId = "00000000-0000-4000-8000-000000000002";
const MIGRATION_FIXTURE_SETUP_TIMEOUT_MS = 30_000;
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
  for (const entry of journal.entries) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Migration SQL and user/chat/conversation foreign-key fixtures require predecessor completion; billing fixtures intentionally replay receipts in order before asserting the ledger.
    await postgres.exec(
      // oxlint-disable-next-line eslint/no-await-in-loop -- Migration SQL and user/chat/conversation foreign-key fixtures require predecessor completion; billing fixtures intentionally replay receipts in order before asserting the ledger.
      await readFile(
        new URL(`migrations/${entry.tag}.sql`, import.meta.url),
        "utf-8"
      )
    );
  }
  await postgres.exec(
    `insert into "user" (id,name,email) values ('owner','owner','owner'), ('other','other','other')`
  );
  await postgres.query(
    `insert into "EveChat" (id,"ownerId",title) values ($1,'owner','Research'), ($2,'other','Research')`,
    [conversationId, otherId]
  );
  await postgres.query(
    `insert into "EveConversation" (id,"chatId","ownerId","operationId","firstMessage","sessionId",state) values ($1,$1,'owner',$1,'Research','root','bound'), ($2,$2,'other',$2,'Research','foreign-root','bound')`,
    [conversationId, otherId]
  );
}, MIGRATION_FIXTURE_SETUP_TIMEOUT_MS);
afterAll(async () => {
  await postgres.close();
});

it("binds descendants idempotently and rejects foreign parents or identity changes", async () => {
  const child = await registerEveSubagent("owner", "root", "child", "turn_1");
  const missing = await getEveSubagent("owner", "unknown");
  expectTypeOf(missing).toEqualTypeOf<typeof child | undefined>();
  expect(missing).toBeUndefined();
  expect(child).toMatchObject({
    conversationId,
    rootSessionId: "root",
    rootTurnId: "turn_1",
  });
  expect(await registerEveSubagent("owner", "root", "child", "turn_1")).toEqual(
    child
  );
  expect(
    await registerEveSubagent("owner", "child", "grandchild", "turn_0")
  ).toMatchObject({ rootSessionId: "root", rootTurnId: "turn_1" });
  await expect(
    registerEveSubagent("other", "root", "stolen", "turn_1")
  ).rejects.toThrow("no owned parent");
  await expect(
    registerEveSubagent("other", "foreign-root", "child", "turn_1")
  ).rejects.toThrow("ownership changed");
  expect(await getEveSubagent("other", "child")).toBeUndefined();
  await expect(
    registerEveSubagent("owner", "root", "child", "turn_2")
  ).rejects.toThrow("fresh child");
});
it("advances child cursors monotonically and revokes stream access when the root is deleted", async () => {
  await registerEveSubagent("owner", "root", "cursor-child", "turn_1");
  await advanceEveSubagentUsageCursor("owner", "cursor-child", 20);
  await advanceEveSubagentUsageCursor("owner", "cursor-child", 10);
  expect(await getEveSubagent("owner", "cursor-child")).toMatchObject({
    usageStreamIndex: 20,
  });
  await registerEveSubagent("other", "foreign-root", "foreign-child", "turn_1");
  const owned = await listEveSubagents("owner");
  expect(owned.every((row) => row.rootSessionId === "root")).toBe(true);
  expect(owned.some((row) => row.sessionId === "foreign-child")).toBe(false);
  const children = await listEveSubagents("owner", "root");
  expect(children.some((row) => row.sessionId === "cursor-child")).toBe(true);
  await postgres.exec(
    "update \"EveConversation\" set state='deleted' where \"sessionId\"='root'"
  );
  expect(await getEveSubagent("owner", "cursor-child")).toBeUndefined();
  await postgres.exec(
    "update \"EveConversation\" set state='bound' where \"sessionId\"='root'"
  );
});

it("charges native child receipts once and rounds their combined cost on the root turn", async () => {
  const attribution = { sessionId: "root", turnId: "turn_3" };
  for (const sessionId of ["paid-one", "paid-two", "paid-one"]) {
    const event = {
      data: {
        result: {
          callId: "search",
          kind: "tool-result",
          output: {
            kind: "chatjs.tool-result",
            output: { answer: "Evidence" },
            status: "success",
            usage: { costUsd: 0.001 },
            version: 1,
          },
          toolName: "webSearch",
        },
        sequence: 0,
        status: "completed",
        stepIndex: 0,
        turnId: "turn_0",
      },
      meta: { at: "2026-09-28T00:00:00Z", id: "same-event-name" },
      type: "action.result",
    } satisfies MessageStreamEvent;
    // oxlint-disable-next-line eslint/no-await-in-loop -- Migration SQL and user/chat/conversation foreign-key fixtures require predecessor completion; billing fixtures intentionally replay receipts in order before asserting the ledger.
    await ingestEveUsage("owner", sessionId, event, attribution);
  }
  const rows = await postgres.query<{
    count: number;
    total: string;
    charged: string;
  }>(
    'select count(*)::int as count, sum("costUsd")::text as total, sum("chargedCents")::text as charged from "EveUsage"'
  );
  expect(rows.rows[0]).toEqual({
    charged: "1",
    count: 2,
    total: "0.002000000000",
  });
});
