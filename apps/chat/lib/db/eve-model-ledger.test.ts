import { readFile } from "node:fs/promises";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { z } from "zod";

import { wrapEveModel } from "@/lib/eve/model-ledger";
import type { ModelAttempt } from "@/lib/eve/model-ledger";

const postgres = new PGlite();
vi.mock("./client", () => {
  const database = drizzle(postgres);
  const transaction = database.transaction.bind(database);
  type Transaction = Parameters<Parameters<typeof database.transaction>[0]>[0];
  // Production postgres-js execute returns rows directly; PGlite wraps them.
  database.transaction = async <Result>(
    runTransaction: (tx: Transaction) => Promise<Result>
  ): Promise<Result> =>
    await transaction(async (tx): Promise<Result> => {
      const execute = tx.execute.bind(tx);
      const adapted = new Proxy(tx, {
        get(target, property, receiver): unknown {
          if (property === "execute") {
            return async (
              ...args: Parameters<typeof execute>
            ): Promise<Record<string, unknown>[]> => {
              const response = await execute(...args);
              return response.rows;
            };
          }
          return Reflect.get(target, property, receiver);
        },
      });
      return await runTransaction(adapted);
    });
  return { db: database };
});
vi.mock("../env", () => ({ env: {} }));
const { eveModelLedger } = await import("./eve-model-ledger");
const { registerEveSubagent } = await import("./eve-subagents");
const { ingestEveUsage } = await import("@/lib/eve/usage");
const receipt = {
  providerMetadata: { gateway: { cost: "0.004", generationId: "provider-id" } },
  usage: {
    inputTokens: { cacheRead: 0, cacheWrite: 0, noCache: 10, total: 10 },
    outputTokens: { reasoning: 0, text: 1, total: 1 },
  },
};
const attempt = (
  eventId: string,
  sessionId = "root",
  turnId: string | undefined = "turn_1"
): ModelAttempt => ({
  eventId,
  modelId: "mock",
  ownerId: "owner",
  provider: "mock",
  sessionId,
  turnId,
});

beforeAll(async () => {
  const journalFile = await readFile(
    new URL("migrations/meta/_journal.json", import.meta.url),
    "utf-8"
  );
  const entrySchema = z.object({ tag: z.string() });
  const journal = z
    .object({ entries: z.array(entrySchema) })
    .parse(JSON.parse(journalFile));
  /* oxlint-disable no-await-in-loop -- Apply dependent schema migrations in journal order. */
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
    INSERT INTO "UserCredit" ("userId", credits) VALUES ('owner', 100);
    INSERT INTO "EveChat" (id, "ownerId", title) VALUES ('00000000-0000-4000-8000-000000000001', 'owner', 'Test');
    INSERT INTO "EveWorkspace" (id, "ownerId") VALUES ('00000000-0000-4000-8000-000000000001', 'owner');
    INSERT INTO "EveConversation" ("workspaceId", "chatId", "ownerId", "operationId", "firstMessage", "sessionId", state)
    VALUES ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'owner', '00000000-0000-4000-8000-000000000001', 'Test', 'root', 'bound');
  `);
}, 30_000);
afterAll(async () => {
  await postgres.close();
});

it("requires an owned bound conversation before recording a model attempt", async () => {
  await expect(
    eveModelLedger.begin({ ...attempt("foreign"), ownerId: "other" })
  ).rejects.toThrow("owned");
  await expect(
    eveModelLedger.begin(attempt("unbound", "missing"))
  ).rejects.toThrow("owned");
});

it("writes before invoking the mock provider, rounds once, and ignores replayed model events", async () => {
  let calls = 0;
  const wrapped = wrapEveModel(
    {
      async doGenerate() {
        calls += 1;
        const pending = await postgres.query(
          'SELECT count(*)::int AS count FROM "EveUsage" WHERE "costUsd" IS NULL'
        );
        expect(pending.rows).toEqual([{ count: 1 }]);
        return {
          ...receipt,
          content: [{ text: "summary", type: "text" }],
          finishReason: { raw: "stop", unified: "stop" },
          warnings: [],
        };
      },
      async doStream() {
        return await Promise.reject(new Error("unexpected stream"));
      },
      modelId: "mock",
      provider: "mock",
      specificationVersion: "v4",
      supportedUrls: {},
    },
    { ownerId: "owner", sessionId: "root", turnId: "turn_1" },
    eveModelLedger
  );
  await wrapped.doGenerate({ prompt: [] });
  await wrapped.doGenerate({ prompt: [] });
  expect(calls).toBe(2);
  /* oxlint-disable no-await-in-loop -- Replay must follow the first ingestion to exercise cursor-independent deduplication. */
  for (const sessionId of ["root", "root"]) {
    await ingestEveUsage("owner", sessionId, {
      data: {
        finishReason: "stop",
        sequence: 0,
        turnId: "turn_1",
        usage: { costUsd: 9 },
      },
      meta: { at: "2026-10-12T00:00:00Z", id: "replayed-step" },
      type: "step.completed",
    });
    await ingestEveUsage("owner", sessionId, {
      data: {
        modelId: "mock",
        sequence: 0,
        sessionId,
        turnId: "turn_1",
        usage: { costUsd: 9 },
      },
      meta: { at: "2026-10-12T00:00:00Z", id: "replayed-compaction" },
      type: "compaction.completed",
    });
  }
  /* oxlint-enable no-await-in-loop */
  const totals = await postgres.query(
    'SELECT sum("chargedCents")::int AS cents, count(*)::int AS calls FROM "EveUsage"'
  );
  expect(totals.rows).toEqual([{ calls: 2, cents: 1 }]);
});

it("settles each distinct descendant attempt against the root turn and reingests receipts once", async () => {
  await registerEveSubagent("owner", "root", "child", "turn_1");
  await registerEveSubagent("owner", "child", "grandchild", "turn_7");
  const call = attempt("child-call", "grandchild", "turn_0");
  await eveModelLedger.begin(call);
  await Promise.all([
    eveModelLedger.finish(call, receipt),
    eveModelLedger.finish(call, receipt),
  ]);
  const rows = await postgres.query(
    'SELECT "sessionId", "turnId", "costUsd", "chargedCents" FROM "EveUsage" WHERE "eventId" = $1',
    [call.eventId]
  );
  expect(rows.rows).toEqual([
    {
      chargedCents: 1,
      costUsd: "0.004000000000",
      sessionId: "root",
      turnId: "turn_1",
    },
  ]);
  await expect(
    eveModelLedger.finish({ ...call, modelId: "different" }, receipt)
  ).rejects.toThrow("identity conflict");
  await expect(
    eveModelLedger.finish(call, {
      ...receipt,
      providerMetadata: { gateway: { cost: "0.02" } },
    })
  ).rejects.toThrow("amount changed");
});

it("keeps independent tool receipts billable alongside model receipts and replay", async () => {
  /* oxlint-disable no-await-in-loop -- Replay the same call after its first durable charge. */
  for (const eventId of ["tool-live", "tool-replay"]) {
    await ingestEveUsage("owner", "root", {
      data: {
        result: {
          callId: "paid-call",
          kind: "tool-result",
          output: {
            kind: "chatjs.tool-result",
            output: "answer",
            status: "success",
            usage: { costUsd: 0.02 },
            version: 1,
          },
        },
        status: "completed",
        turnId: "turn_1",
      },
      meta: { at: "2026-10-12T00:00:00Z", id: eventId },
      type: "action.result",
    });
  }
  /* oxlint-enable no-await-in-loop */
  const rows = await postgres.query(
    'SELECT "costUsd" FROM "EveUsage" WHERE "eventId" = $1',
    ["eve-tool:root:paid-call"]
  );
  expect(rows.rows).toEqual([{ costUsd: "0.020000000000" }]);
});

it("preserves receipt evidence across enrichment and rejects conflicting replay", async () => {
  const call = attempt("immutable-receipt");
  const response = {
    id: "response-id",
    timestamp: new Date("2026-10-17T00:00:00Z"),
  };
  await eveModelLedger.begin(call);
  await eveModelLedger.observe?.(call, response);
  await eveModelLedger.finish(call, { usage: receipt.usage, response });
  const enriched = {
    ...receipt,
    providerMetadata: {
      gateway: { ...receipt.providerMetadata.gateway, route: "original" },
    },
    response,
  };
  await eveModelLedger.finish(call, enriched);
  await eveModelLedger.finish(call, enriched);
  await expect(
    eveModelLedger.finish(call, {
      ...receipt,
      usage: {
        ...receipt.usage,
        outputTokens: { ...receipt.usage.outputTokens, total: 999 },
      },
    })
  ).rejects.toThrow("evidence conflict");
  await expect(
    eveModelLedger.finish(call, {
      ...receipt,
      providerMetadata: {
        gateway: {
          ...receipt.providerMetadata.gateway,
          cost: "0.004",
          generationId: "provider-id",
          changed: true,
        },
      },
      response: { id: "different-response" },
    })
  ).rejects.toThrow("evidence conflict");
  await expect(
    eveModelLedger.finish(call, {
      ...enriched,
      providerMetadata: {
        gateway: { ...enriched.providerMetadata.gateway, route: "changed" },
      },
    })
  ).rejects.toThrow("evidence conflict");
  const rows = await postgres.query(
    'SELECT "modelAttempt", "chargedCents" FROM "EveUsage" WHERE "eventId" = $1',
    [call.eventId]
  );
  expect(rows.rows).toEqual([
    {
      chargedCents: 0,
      modelAttempt: {
        ...call,
        ...enriched,
        response: { ...response, timestamp: response.timestamp.toISOString() },
        state: "returned",
      },
    },
  ]);
});

it("separates maintenance and preserves missing or crash-lost receipts without blocking calls", async () => {
  const maintenance = { ...attempt("maintenance"), turnId: undefined };
  await eveModelLedger.begin(maintenance);
  await eveModelLedger.finish(maintenance, { usage: receipt.usage });
  await ingestEveUsage("owner", "root", {
    data: {
      sequence: 2,
      turnId: "turn_2",
    },
    meta: { at: "2026-10-12T00:00:00Z", id: "completion" },
    type: "turn.completed",
  });

  const rows = await postgres.query(
    'SELECT "turnId", "costUsd", "modelAttempt"->>\'state\' AS state FROM "EveUsage" WHERE "eventId" = $1',
    [maintenance.eventId]
  );
  expect(rows.rows).toEqual([
    { costUsd: null, state: "returned", turnId: "chatjs:maintenance" },
  ]);
  await eveModelLedger.finish(maintenance, receipt);
  const lost = attempt("provider-returned-process-crashed");
  await eveModelLedger.begin(lost);

  await expect(
    eveModelLedger.finish(attempt("no-intent"), receipt)
  ).rejects.toThrow("no durable intent");
});
