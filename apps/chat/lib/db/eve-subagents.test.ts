/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This test harness requires import { readFile } from "node:fs/promises";; its Node runtime boundary deliberately permits these built-ins.
 */
/* oxlint-disable eslint/no-await-in-loop -- Apply real migrations and verify ordered durable billing operations. */
import { readFile } from "node:fs/promises";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { PGlite } from "@electric-sql/pglite";
/* oxlint-enable sort-imports */
import { drizzle } from "drizzle-orm/pglite";
/* oxlint-disable sort-imports -- The EVE event type and Vitest runtime import occupy conflicting native binding-syntax and local-binding sort groups; retain the test runner import with this suite's hoisted mocks. */
import type { MessageStreamEvent } from "eve/client";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-nodejs-modules */

const postgres = new PGlite();
vi.mock("./client", () => ({ db: drizzle(postgres) }));
vi.mock("../env", () => ({ env: {} }));
const {
  registerEveSubagent,
  getEveSubagent,
  advanceEveSubagentUsageCursor,
  listEveSubagents,
  // oxlint-disable-next-line node/no-top-level-await -- This Vitest suite loads subagent queries after installing its PGlite database mock.
} = await import("./eve-subagents");
/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../eve/usage" dependency within this package instead of introducing an alias or barrel API.
 */
// oxlint-disable-next-line node/no-top-level-await -- This Vitest suite loads usage ingestion after installing the same PGlite database mock.
const { ingestEveUsage } = await import("../eve/usage");
/* oxlint-enable import/no-relative-parent-imports */
const conversationId = "00000000-0000-4000-8000-000000000001";
const otherId = "00000000-0000-4000-8000-000000000002";
const MIGRATION_FIXTURE_SETUP_TIMEOUT_MS = 30_000;
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve beforeAll's awaited sequencing and rejected-Promise behavior. */
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
}, MIGRATION_FIXTURE_SETUP_TIMEOUT_MS);
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable typescript/promise-function-async --
 * typescript/promise-function-async (#606): afterAll preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
afterAll(() => postgres.close());
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-statements, no-magic-numbers --
 * max-statements (#512): it("advances child cursors monotonically and revokes stream access when the root is d keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): it("advances child cursors monotonically and revokes stream access when the root is deleted") advances the cursor to 20 then submits stale cursor 10 and asserts the persisted cursor remains 20; these values exercise the monotonicity contract.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, no-magic-numbers */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("charges native child receipts once and rounds their combined cost on the root turn") asserts two receipts contribute $0.002 and round to one cent; event sequence and step indices begin at 0 per the native receipt schema.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-magic-numbers */
