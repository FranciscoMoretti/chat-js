import { createEveTestSession } from "./eve-native-session.fixture";

import { eq } from "drizzle-orm";
import { afterAll, beforeEach, expect, test, vi } from "vitest";

import { db } from "../lib/db/client";
import {
  advanceEveUsageCursor,
  getEveUsageCursor,
  recordEveUsage,
  withManagedUsageReconciliation,
} from "../lib/db/eve-billing";
import { createEveConversation } from "../lib/db/eve-queries";
import { eveConversation, eveUsage, user, userCredit } from "../lib/db/schema";
import { env } from "../lib/env";
import { eveModelLedger } from "../lib/db/eve-model-ledger";
import { createToolResult } from "../lib/eve/tool-result";
import { reconcileEveUsage } from "../lib/eve/reconcile-usage";
import { assertEveTestDatabase } from "./eve-test-database";

vi.mock("server-only", () => ({}));
vi.mock("../lib/eve/server", () => ({ assertEveConfigured: vi.fn() }));

const transport = vi.hoisted(() => ({
  stream:
    vi.fn<
      (options: {
        readonly startIndex?: number;
        readonly follow?: boolean;
      }) => Iterable<unknown>
    >(),
}));

vi.mock("eve/client", () => ({
  Client: class {
    public sessions = { attach: () => ({ stream: transport.stream }) };
  },
}));
assertEveTestDatabase(env.DATABASE_URL);
const owner = crypto.randomUUID();
await db
  .insert(user)
  .values({ email: `${owner}@test.invalid`, id: owner, name: "Cursor test" });
afterAll(async () => {
  await db.delete(eveUsage).where(eq(eveUsage.ownerId, owner));
  await db.delete(eveConversation).where(eq(eveConversation.ownerId, owner));
  await db.delete(userCredit).where(eq(userCredit.userId, owner));
  await db.delete(user).where(eq(user.id, owner));
});
beforeEach(() => {
  transport.stream.mockReset();
});
const session = async (): Promise<string> => {
  const row = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Cursor fixture",
    createEveTestSession
  );
  if (!row.sessionId) {
    throw new Error("Missing test session");
  }
  return row.sessionId;
};
const tool = (costUsd?: number) => ({
  data: {
    turnId: "turn_0",
    status: "completed",
    result: {
      kind: "tool-result",
      callId: crypto.randomUUID(),
      output: createToolResult("result", costUsd),
    },
  },
  meta: { id: crypto.randomUUID() },
  type: "action.result",
});

test("settled prefixes are not downloaded again and appended charges are ingested", async () => {
  const id = await session();
  const events = [tool(0.05)];
  const delivered: string[] = [];
  transport.stream.mockImplementation(function* streamUsageEventsFromCursor({
    startIndex,
    follow,
  }) {
    expect(follow).toBe(false);
    for (const event of events.slice(startIndex)) {
      delivered.push(event.meta.id);
      yield event;
    }
  });
  await reconcileEveUsage(owner, id);
  await reconcileEveUsage(owner, id);
  events.push(tool(0.02));
  await reconcileEveUsage(owner, id);
  expect(
    transport.stream.mock.calls.map(
      ([options]: readonly [
        options: { readonly startIndex?: number; readonly follow?: boolean },
      ]) => options.startIndex
    )
  ).toEqual([0, 1, 1]);
  expect(delivered).toEqual(
    events.map(
      (event: Readonly<{ meta: Readonly<{ id: string }> }>) => event.meta.id
    )
  );
  expect(await getEveUsageCursor(owner, id)).toBe(2);
  const rows = await db
    .select()
    .from(eveUsage)
    .where(eq(eveUsage.sessionId, id));
  expect(
    rows.reduce(
      (sum, row: { readonly chargedCents: number }) => sum + row.chargedCents,
      0
    )
  ).toBe(7);
});

test("a transport failure after a debit retains the cursor and retry does not charge twice", async () => {
  const id = await session();
  const event = tool(0.05);
  transport.stream.mockImplementationOnce(function* streamThenFailAfterYield() {
    yield event;
    throw new Error("lost tail");
  });
  await expect(reconcileEveUsage(owner, id)).rejects.toThrow("lost tail");
  expect(await getEveUsageCursor(owner, id)).toBe(0);
  transport.stream.mockImplementation(function* retryStreamFromCursor({
    startIndex,
  }) {
    if (startIndex === 0) {
      yield event;
    }
  });
  await Promise.all([
    reconcileEveUsage(owner, id),
    reconcileEveUsage(owner, id),
  ]);
  expect(await getEveUsageCursor(owner, id)).toBe(1);
  const rows = await db
    .select()
    .from(eveUsage)
    .where(eq(eveUsage.sessionId, id));
  expect(rows).toHaveLength(1);
  expect(rows[0].chargedCents).toBe(5);
});

test("missing tool cost blocks cursor advancement until its exact receipt is reconciled", async () => {
  const id = await session();
  const event = tool();
  transport.stream.mockImplementation(function* streamMissingCostEvent({
    startIndex,
  }) {
    if (startIndex === 0) {
      yield event;
    }
  });
  await expect(reconcileEveUsage(owner, id)).resolves.toBeUndefined();
  await withManagedUsageReconciliation(owner, async (_due, unpriced) => {
    expect(unpriced.has(id)).toBe(true);
    await Promise.resolve();
  });
  expect(await getEveUsageCursor(owner, id)).toBe(0);
  await recordEveUsage({
    costUsd: 0.03,
    eventId: `eve-tool:${id}:${event.data.result.callId}`,
    ownerId: owner,
    sessionId: id,
    turnId: "turn_0",
  });
  await reconcileEveUsage(owner, id);
  expect(await getEveUsageCursor(owner, id)).toBe(1);
});

test("cursor writes are monotonic, owner scoped, and fenced after retirement", async () => {
  const id = await session();
  await advanceEveUsageCursor(owner, id, 9);
  await advanceEveUsageCursor(owner, id, 3);
  expect(await getEveUsageCursor(owner, id)).toBe(9);
  await expect(reconcileEveUsage("stranger", id)).rejects.toThrow(
    "Conversation not found"
  );
  expect(transport.stream).not.toHaveBeenCalled();
  await expect(advanceEveUsageCursor("stranger", id, 10)).rejects.toThrow(
    "Conversation not found"
  );
  await expect(advanceEveUsageCursor(owner, id, -1)).rejects.toThrow(
    "Invalid Eve usage cursor"
  );
  await db
    .update(eveConversation)
    .set({ state: "deleting" })
    .where(eq(eveConversation.sessionId, id));
  await expect(advanceEveUsageCursor(owner, id, 10)).rejects.toThrow(
    "Conversation not found"
  );
});

test("unpriced model attempts remain durable while later work continues", async () => {
  const id = await session();
  const attempt = {
    eventId: crypto.randomUUID(),
    modelId: "model",
    provider: "mock",
    ownerId: owner,
    sessionId: id,
    turnId: "turn_0",
  };
  await eveModelLedger.begin(attempt);
  transport.stream.mockImplementation(function* streamCompletion() {
    yield {
      data: { sequence: 0, turnId: "turn_0" },
      meta: { at: new Date().toISOString(), id: crypto.randomUUID() },
      type: "turn.completed",
    };
  });
  await reconcileEveUsage(owner, id);
  expect(await getEveUsageCursor(owner, id)).toBe(1);
  await eveModelLedger.begin({
    ...attempt,
    eventId: crypto.randomUUID(),
    turnId: "turn_1",
  });
  const [unpriced] = await db
    .select()
    .from(eveUsage)
    .where(eq(eveUsage.eventId, attempt.eventId));
  expect(unpriced.costUsd).toBeNull();
  await withManagedUsageReconciliation(owner, async (_due, toolSessions) => {
    // Runtime replay can repair tool receipts, not application-owned model intents.
    expect(toolSessions.has(id)).toBe(false);
    await Promise.resolve();
  });
  await eveModelLedger.finish(attempt, {
    usage: {
      inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 1, text: 1, reasoning: 0 },
    },
    providerMetadata: { gateway: { cost: "0.001" } },
  });
  const [settled] = await db
    .select()
    .from(eveUsage)
    .where(eq(eveUsage.eventId, attempt.eventId));
  expect(settled.costUsd).toBe("0.001000000000");
});
