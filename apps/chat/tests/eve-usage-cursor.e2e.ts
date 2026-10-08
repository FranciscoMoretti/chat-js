/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/eve-billing"; "../lib/db/eve-queries"; "../lib/db/schema"; "../lib/env" dependency within this package instead of introducing an alias or barrel API.
 */
/* oxlint-disable eslint/func-style -- Hoisted test helpers keep scenario setup readable and stable. */
/* oxlint-disable eslint/require-await -- Async mocks preserve the Promise-returning production callback contract. */
import { eq } from "drizzle-orm";
/* oxlint-disable eslint/sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { afterAll, beforeEach, expect, test, vi } from "vitest";
/* oxlint-enable eslint/sort-imports */

import { db } from "../lib/db/client";
/* oxlint-disable eslint/sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  advanceEveUsageCursor,
  getEveUsageCursor,
  recordEveUsage,
} from "../lib/db/eve-billing";
/* oxlint-enable eslint/sort-imports */
import { createEveConversation } from "../lib/db/eve-queries";
/* oxlint-disable eslint/sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { eveConversation, eveUsage, user, userCredit } from "../lib/db/schema";
/* oxlint-enable eslint/sort-imports */
import { env } from "../lib/env";
import { reconcileEveUsage } from "../lib/eve/reconcile-usage";
/* oxlint-disable eslint/sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable eslint/sort-imports */
/* oxlint-enable import/no-relative-parent-imports */

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
// oxlint-disable-next-line node/no-top-level-await -- This Bun database suite inserts the usage owner before registering cursor scenarios.
await db
  .insert(user)
  .values({ email: `${owner}@test.invalid`, id: owner, name: "Cursor test" });
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve afterAll's awaited sequencing and rejected-Promise behavior. */
afterAll(async () => {
  await db.delete(eveUsage).where(eq(eveUsage.ownerId, owner));
  await db.delete(eveConversation).where(eq(eveConversation.ownerId, owner));
  await db.delete(userCredit).where(eq(userCredit.userId, owner));
  await db.delete(user).where(eq(user.id, owner));
});
/* oxlint-enable oxc/no-async-await */
beforeEach(() => {
  transport.stream.mockReset();
});
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve session's awaited sequencing and rejected-Promise behavior. Native-session fixture resolves crypto.randomUUID() for createEveConversation; synchronous return would fail its create callback contract. */
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
/* oxlint-enable oxc/no-async-await */
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
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable max-statements, no-magic-numbers --
 * max-statements (#512): test("settled prefixes are not downloaded again and appended charges are ingested") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("settled prefixes are not downloaded again and appended charges are ingested") uses 0.05, 0.02, 0, 1, 2, 7 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("settled prefixes are not downloaded again and appended charges are ingested", async () => {
  const id = await session();
  const events = [step(0.05)];
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
  events.push(step(0.02));
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, no-magic-numbers */

/* oxlint-disable max-statements, no-magic-numbers --
 * max-statements (#512): test("a transport failure after a debit retains the cursor and retry does not charge  keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("a transport failure after a debit retains the cursor and retry does not charge  uses 0.05, 0, 1, 5 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("a transport failure after a debit retains the cursor and retry does not charge twice", async () => {
  const id = await session();
  const event = step(0.05);
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test.each(["step.completed", "compaction.usage"])'s awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, no-magic-numbers */

/* oxlint-disable no-magic-numbers, no-undefined --
 * no-magic-numbers (#517): test.each(["step.completed", "compaction.usage"])("missing %s cost blocks cursor adva uses 0, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): test.each(["step.completed", "compaction.usage"])("missing %s cost blocks cursor adva uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
test.each(["step.completed", "compaction.usage"])(
  "missing %s cost blocks cursor advancement until durable provider reconciliation",
  async (type) => {
    const id = await session();
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing step(undefined) own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    const event = { ...step(undefined), type };
    transport.stream.mockImplementation(function* streamMissingCostEvent({
      startIndex,
    }) {
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers, no-undefined */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test("compaction attempts share per-turn rounding and replay does not double-charge") uses 0.004, 0.003, 3, 0, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("compaction attempts share per-turn rounding and replay does not double-charge", async () => {
  const id = await session();
  const events = [
    step(0.004),
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing step(0.003) own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    { ...step(0.003), type: "compaction.usage" },
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing step(0.004) own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    { ...step(0.004), type: "compaction.usage" },
  ];
  transport.stream.mockImplementation(function* streamUsageEventsFromCursor({
    startIndex,
  }) {
    yield* events.slice(startIndex);
  });
  await reconcileEveUsage(owner, id);
  await reconcileEveUsage(owner, id);
  const rows = await db
    .select()
    .from(eveUsage)
    .where(eq(eveUsage.sessionId, id));
  expect(rows).toHaveLength(3);
  expect(
    rows.reduce(
      (sum, row: { readonly chargedCents: number }) => sum + row.chargedCents,
      0
    )
  ).toBe(2);
  expect(await getEveUsageCursor(owner, id)).toBe(3);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test("unpriced auxiliary usage retains the unread cursor until its exact attempt is r uses 0, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
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
  transport.stream.mockImplementation(function* streamAuxiliaryUsageEvent({
    startIndex,
  }) {
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-magic-numbers */
