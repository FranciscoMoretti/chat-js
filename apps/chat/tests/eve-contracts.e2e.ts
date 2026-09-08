import { eq } from "drizzle-orm";
import { afterAll, expect, test } from "vitest";
import { db } from "../lib/db/client";
import { recordEveUsage } from "../lib/db/eve-billing";
import { createEveConversation, ownsEveSession } from "../lib/db/eve-queries";
import { eveConversation, eveUsage, user, userCredit } from "../lib/db/schema";
import { env } from "../lib/env";

if (!new URL(env.DATABASE_URL).hostname.match(/^(127\.0\.0\.1|localhost)$/)) {
  throw new Error("These tests require an isolated local database.");
}
const owner = crypto.randomUUID();
await db
  .insert(user)
  .values({ id: owner, email: `${owner}@test.invalid`, name: "Eve test" });
afterAll(async () => {
  await db.delete(eveUsage).where(eq(eveUsage.ownerId, owner));
  await db.delete(eveConversation).where(eq(eveConversation.ownerId, owner));
  await db.delete(user).where(eq(user.id, owner));
});

test("billing replay is atomic, rounds per turn and preserves unknown costs", async () => {
  await db
    .insert(userCredit)
    .values({ userId: owner, credits: 50 })
    .onConflictDoNothing();
  const sessionId = crypto.randomUUID();
  const eventId = crypto.randomUUID();
  const entry = {
    sessionId,
    eventId,
    ownerId: owner,
    turnId: "turn_0",
    costUsd: 0.001,
  };
  await Promise.all(Array.from({ length: 8 }, () => recordEveUsage(entry)));
  await recordEveUsage({ ...entry, eventId: crypto.randomUUID() });
  let [balance] = await db
    .select()
    .from(userCredit)
    .where(eq(userCredit.userId, owner));
  expect(balance?.credits).toBe(49);
  const unknown = {
    ...entry,
    eventId: crypto.randomUUID(),
    turnId: "turn_1",
    costUsd: undefined,
  };
  expect(await recordEveUsage(unknown)).toBe(false);
  const [row] = await db
    .select()
    .from(eveUsage)
    .where(eq(eveUsage.eventId, unknown.eventId));
  expect(row?.costUsd).toBeNull();
  expect(await recordEveUsage({ ...unknown, costUsd: 0.015 })).toBe(true);
  await recordEveUsage({ ...unknown, costUsd: 0.015 });
  [balance] = await db
    .select()
    .from(userCredit)
    .where(eq(userCredit.userId, owner));
  expect(balance?.credits).toBe(47);
  expect(await recordEveUsage(unknown)).toBe(true);
  await expect(recordEveUsage({ ...entry, costUsd: 0.5 })).rejects.toThrow(
    "amount changed"
  );
  const precise = {
    ...entry,
    eventId: crypto.randomUUID(),
    turnId: "precision",
    costUsd: 0.001_000_000_000_000_000_2,
  };
  await recordEveUsage(precise);
  await recordEveUsage(precise);
});
test("concurrent retry reserves once and cannot cross owners", async () => {
  const operation = crypto.randomUUID();
  let starts = 0;
  const start = async () => {
    starts++;
    await new Promise((resolve) => setTimeout(resolve, 50));
    return `test-${crypto.randomUUID()}`;
  };
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, () =>
      createEveConversation(owner, operation, "hello", start)
    )
  );
  expect(starts).toBe(1);
  expect(
    results.filter((result) => result.status === "fulfilled").length
  ).toBeGreaterThan(0);
  const bound = await createEveConversation(owner, operation, "hello", start);
  expect(starts).toBe(1);
  expect(await ownsEveSession(owner, bound.sessionId)).toBe(true);
  expect(await ownsEveSession("other", bound.sessionId)).toBe(false);
  await expect(
    createEveConversation(owner, operation, "changed", start)
  ).rejects.toThrow("different");
});
test("unknown create remains unresolved and is not dispatched again", async () => {
  const operation = crypto.randomUUID();
  let starts = 0;
  const start = () => {
    starts++;
    return Promise.reject(new Error("lost reply"));
  };
  await expect(
    createEveConversation(owner, operation, "uncertain", start)
  ).rejects.toThrow("lost reply");
  await expect(
    createEveConversation(owner, operation, "uncertain", start)
  ).rejects.toThrow("unresolved");
  expect(starts).toBe(1);
});
