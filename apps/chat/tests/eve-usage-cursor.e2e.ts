/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/eve-billing"; "../lib/db/eve-queries"; "../lib/db/schema"; "../lib/env" dependency within this package instead of introducing an alias or barrel API.
 */
/* oxlint-disable eslint/func-names -- Anonymous spies expose their behavior through the owning test variable. */
/* oxlint-disable eslint/func-style -- Hoisted test helpers keep scenario setup readable and stable. */
/* oxlint-disable eslint/require-await -- Async mocks preserve the Promise-returning production callback contract. */
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
/* oxlint-enable import/no-relative-parent-imports */

vi.mock("server-only", () => ({}));
vi.mock("../lib/eve/server", () => ({ assertEveConfigured: vi.fn() }));
/* oxlint-disable typescript/prefer-readonly-parameter-types --
 * typescript/prefer-readonly-parameter-types (#565): transport accepts options: { startIndex?: number; follow?: boolean }; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
const transport = vi.hoisted(() => ({
  stream:
    vi.fn<
      (options: { startIndex?: number; follow?: boolean }) => Iterable<unknown>
    >(),
}));
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("eve/client")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
vi.mock("eve/client", () => ({
  Client: class {
    public sessions = { attach: () => ({ stream: transport.stream }) };
  },
}));
/* oxlint-enable typescript/explicit-function-return-type */
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
async function session(): Promise<string> {
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
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep step's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
function step(costUsd: number | undefined) {
  return {
    data: { turnId: "turn_0", usage: { costUsd } },
    meta: { id: crypto.randomUUID() },
    type: "step.completed",
  };
}
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types --
 * max-statements (#512): test("settled prefixes are not downloaded again and appended charges are ingested") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("settled prefixes are not downloaded again and appended charges are ingested") uses 0.05, 0.02, 0, 1, 2, 7 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("settled prefixes are not downloaded again and appended charges are ingested") accepts { startIndex, follow }; [options]; event; row; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types --
 * max-statements (#512): test("a transport failure after a debit retains the cursor and retry does not charge  keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("a transport failure after a debit retains the cursor and retry does not charge  uses 0.05, 0, 1, 5 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("a transport failure after a debit retains the cursor and retry does not charge  accepts { startIndex }; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types --
 * no-magic-numbers (#517): test.each(["step.completed", "compaction.usage"])("missing %s cost blocks cursor adva uses 0, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): test.each(["step.completed", "compaction.usage"])("missing %s cost blocks cursor adva uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/prefer-readonly-parameter-types (#565): test.each(["step.completed", "compaction.usage"])("missing %s cost blocks cursor adva accepts { startIndex }; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
test.each(["step.completed", "compaction.usage"])(
  "missing %s cost blocks cursor advancement until durable provider reconciliation",
  async (type) => {
    const id = await session();
    const event = { ...step(undefined), type };
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
      costUsd: 0.03,
      eventId: event.meta.id,
      ownerId: owner,
      sessionId: id,
      turnId: "turn_0",
    });
    await reconcileEveUsage(owner, id);
    expect(await getEveUsageCursor(owner, id)).toBe(1);
  }
);
/* oxlint-enable no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types --
 * no-magic-numbers (#517): test("compaction attempts share per-turn rounding and replay does not double-charge") uses 0.004, 0.003, 3, 0, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("compaction attempts share per-turn rounding and replay does not double-charge") accepts { startIndex }; row; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
test("compaction attempts share per-turn rounding and replay does not double-charge", async () => {
  const id = await session();
  const events = [
    step(0.004),
    { ...step(0.003), type: "compaction.usage" },
    { ...step(0.004), type: "compaction.usage" },
  ];
  transport.stream.mockImplementation(function* ({ startIndex }) {
    yield* events.slice(startIndex);
  });
  await reconcileEveUsage(owner, id);
  await reconcileEveUsage(owner, id);
  const rows = await db
    .select()
    .from(eveUsage)
    .where(eq(eveUsage.sessionId, id));
  expect(rows).toHaveLength(3);
  expect(rows.reduce((sum, row) => sum + row.chargedCents, 0)).toBe(2);
  expect(await getEveUsageCursor(owner, id)).toBe(3);
});
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test("cursor writes are monotonic, owner scoped, and fenced after retirement") uses 9, 3, 10, -1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types --
 * no-magic-numbers (#517): test("unpriced auxiliary usage retains the unread cursor until its exact attempt is r uses 0, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("unpriced auxiliary usage retains the unread cursor until its exact attempt is r accepts { startIndex }; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
test("unpriced auxiliary usage retains the unread cursor until its exact attempt is reconciled", async () => {
  const id = await session();
  const event = {
    data: {
      hookId: "followup-suggestions",
      modelCalls: [{ modelId: "model" }],
      turnId: "turn_0",
    },
    meta: { at: new Date().toISOString(), id: crypto.randomUUID() },
    type: "hook.result",
  };
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
    costUsd: 0.001,
    eventId: `${event.meta.id}:model-call:0`,
    ownerId: owner,
    sessionId: id,
    turnId: "turn_0",
  });
  await reconcileEveUsage(owner, id);
  expect(await getEveUsageCursor(owner, id)).toBe(1);
});
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types */
