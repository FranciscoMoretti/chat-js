import { eq } from "drizzle-orm";
import { afterAll, expect, test } from "vitest";
import { db } from "../lib/db/client";
import { createEveConversation, ownsEveSession } from "../lib/db/eve-queries";
import { eveConversation, user } from "../lib/db/schema";
import { env } from "../lib/env";

if (!new URL(env.DATABASE_URL).hostname.match(/^(127\.0\.0\.1|localhost)$/)) {
  throw new Error("These tests require an isolated local database.");
}
const owner = crypto.randomUUID();
await db
  .insert(user)
  .values({ id: owner, email: `${owner}@test.invalid`, name: "Eve test" });
afterAll(async () => {
  await db.delete(eveConversation).where(eq(eveConversation.ownerId, owner));
  await db.delete(user).where(eq(user.id, owner));
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
