import { eq } from "drizzle-orm";
import { afterAll, beforeEach, expect, test, vi } from "vitest";
import { db } from "../lib/db/client";
import {
  advanceEveUsageCursor,
  getEveUsageCursor,
  recordEveUsage,
} from "../lib/db/eve-billing";
import { createEveConversation } from "../lib/db/eve-queries";
import { eveConversation, eveUsage, user, userCredit } from "../lib/db/schema";
import { env } from "../lib/env";
import { reconcileEveUsage } from "../lib/eve/reconcile-usage";
import { assertEveTestDatabase } from "./eve-test-database";

vi.mock("server-only", () => ({}));
vi.mock("../lib/eve/server", () => ({ assertEveConfigured: vi.fn() }));
const transport = vi.hoisted(() => ({ stream: vi.fn() }));
vi.mock("eve/client", () => ({
  Client: class {
    sessions = { attach: () => ({ stream: transport.stream }) };
  },
}));
assertEveTestDatabase(env.DATABASE_URL);
const owner = crypto.randomUUID();
await db
  .insert(user)
  .values({ id: owner, email: `${owner}@test.invalid`, name: "Cursor test" });
afterAll(async () => {
  await db.delete(eveUsage).where(eq(eveUsage.ownerId, owner));
  await db.delete(eveConversation).where(eq(eveConversation.ownerId, owner));
  await db.delete(userCredit).where(eq(userCredit.userId, owner));
  await db.delete(user).where(eq(user.id, owner));
});
beforeEach(() => {
  transport.stream.mockReset();
});
async function session() {
  const row = await createEveConversation(
    owner,
    crypto.randomUUID(),
    "Cursor fixture",
    async () => crypto.randomUUID()
  );
  if (!row.sessionId) {
    throw new Error("Missing test session");
  }
  return row.sessionId;
}
function step(costUsd: number | undefined) {
  return {
    type: "step.completed",
    meta: { id: crypto.randomUUID() },
    data: { turnId: "turn_0", usage: { costUsd } },
  };
}

test("settled prefixes are not downloaded again and appended charges are ingested", async () => {
  const id = await session();
  const events = [step(0.05)];
  const delivered: string[] = [];
  transport.stream.mockImplementation(function* ({ startIndex, follow }) {
    expect(follow).toBe(false);
    for (const event of events.slice(startIndex)) {
      delivered.push(event.meta.id);
      yield event;
    }
  });
  await reconcileEveUsage(owner, id);
  await reconcileEveUsage(owner, id);
  events.push(step(0.02));
  await reconcileEveUsage(owner, id);
  expect(
    transport.stream.mock.calls.map(([options]) => options.startIndex)
  ).toEqual([0, 1, 1]);
  expect(delivered).toEqual(events.map((event) => event.meta.id));
  expect(await getEveUsageCursor(owner, id)).toBe(2);
  const rows = await db
    .select()
    .from(eveUsage)
    .where(eq(eveUsage.sessionId, id));
  expect(rows.reduce((sum, row) => sum + row.chargedCents, 0)).toBe(7);
});

test("a transport failure after a debit retains the cursor and retry does not charge twice", async () => {
  const id = await session();
  const event = step(0.05);
  transport.stream.mockImplementationOnce(function* () {
    yield event;
    throw new Error("lost tail");
  });
  await expect(reconcileEveUsage(owner, id)).rejects.toThrow("lost tail");
  expect(await getEveUsageCursor(owner, id)).toBe(0);
  transport.stream.mockImplementation(function* ({ startIndex }) {
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

test("missing cost blocks cursor advancement until durable provider reconciliation", async () => {
  const id = await session();
  const event = step(undefined);
  transport.stream.mockImplementation(function* ({ startIndex }) {
    if (startIndex === 0) {
      yield event;
    }
  });
  await expect(reconcileEveUsage(owner, id)).rejects.toThrow(
    "provider cost reconciliation"
  );
  expect(await getEveUsageCursor(owner, id)).toBe(0);
  await recordEveUsage({
    ownerId: owner,
    sessionId: id,
    eventId: event.meta.id,
    turnId: "turn_0",
    costUsd: 0.03,
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
