/* oxlint-disable import/no-nodejs-modules  --
 * import/no-nodejs-modules (#529): This test harness requires import { readFile } from "node:fs/promises";; its Node runtime boundary deliberately permits these built-ins.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
/* oxlint-disable eslint/no-await-in-loop -- Apply real migrations and verify ordered durable billing operations. */
import { readFile } from "node:fs/promises";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
/* oxlint-enable import/no-nodejs-modules */

const postgres = new PGlite();
vi.mock("./client", () => ({ db: drizzle(postgres) }));
vi.mock("../env", () => ({ env: {} }));
const {
  registerEveSubagent,
  getEveSubagent,
  advanceEveSubagentUsageCursor,
  listEveSubagents,
} = await import("./eve-subagents");
/* oxlint-disable import/no-relative-parent-imports  --
 * import/no-relative-parent-imports (#530): Keep the explicit "../eve/usage" dependency within this package instead of introducing an alias or barrel API.
 * node/no-top-level-await (#539): { ingestEveUsage } runs in the configured Bun/ESM entrypoint and must finish before following module work; do not introduce background initialization.
 */
const { ingestEveUsage } = await import("../eve/usage");
/* oxlint-enable import/no-relative-parent-imports */
const conversationId = "00000000-0000-4000-8000-000000000001";
const otherId = "00000000-0000-4000-8000-000000000002";
/* oxlint-disable no-magic-numbers  --
 * no-magic-numbers (#517): beforeAll uses 30_000 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): beforeAll sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
beforeAll(async () => {
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- #595: This eve-subagents fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  const journal = JSON.parse(
    await readFile(
      new URL("migrations/meta/_journal.json", import.meta.url),
      "utf-8"
    )
  );
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- #597: This eve-subagents fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  for (const entry of journal.entries) {
    await postgres.exec(
      await readFile(
        // oxlint-disable-next-line typescript/no-unsafe-member-access -- #597: This eve-subagents fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
        new URL(`migrations/${entry.tag}.sql`, import.meta.url),
        "utf-8"
      )
    );
  }
  for (const [id, owner, session] of [
    [conversationId, "owner", "root"],
    [otherId, "other", "foreign-root"],
  ]) {
    await postgres.query(
      'insert into "user" (id,name,email) values ($1,$1,$1)',
      [owner]
    );
    await postgres.query(
      'insert into "EveChat" (id,"ownerId",title) values ($1,$2,\'Research\')',
      [id, owner]
    );
    await postgres.query(
      'insert into "EveConversation" (id,"chatId","ownerId","operationId","firstMessage","sessionId",state) values ($1,$1,$2,$1,\'Research\',$3,\'bound\')',
      [id, owner, session]
    );
  }
}, 30_000);
/* oxlint-enable no-magic-numbers */
/* oxlint-disable typescript/promise-function-async --
 * typescript/promise-function-async (#606): afterAll preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
afterAll(() => postgres.close());
/* oxlint-enable typescript/promise-function-async */

it("binds descendants idempotently and rejects foreign parents or identity changes", async () => {
  const child = await registerEveSubagent("owner", "root", "child", "turn_1");
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

/* oxlint-disable max-statements, no-magic-numbers  --
 * max-statements (#512): it("advances child cursors monotonically and revokes stream access when the root is d keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): it("advances child cursors monotonically and revokes stream access when the root is d uses 20, 10 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): it("advances child cursors monotonically and revokes stream access when the root is d sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
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
/* oxlint-enable max-statements, no-magic-numbers */

/* oxlint-disable no-magic-numbers  --
 * no-magic-numbers (#517): it("charges native child receipts once and rounds their combined cost on the root tur uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): it("charges native child receipts once and rounds their combined cost on the root tur sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
it("charges native child receipts once and rounds their combined cost on the root turn", async () => {
  const attribution = { sessionId: "root", turnId: "turn_3" };
  for (const sessionId of ["paid-one", "paid-two", "paid-one"]) {
    await ingestEveUsage(
      "owner",
      sessionId,
      {
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
      },
      attribution
    );
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
/* oxlint-enable no-magic-numbers */
