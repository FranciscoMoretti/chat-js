/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
/* oxlint-disable unicorn/no-await-expression-member -- Direct awaited assertions keep each test action tied to its expectation. */
import { eq, inArray } from "drizzle-orm";
import { afterAll, expect, test } from "vitest";

import { db } from "../lib/db/client";
import { claimExpiredEveGuestFamilies } from "../lib/db/eve-guest-cleanup";
import { createEveGuest } from "../lib/db/eve-guests";
import { eveConversation, eveGuest, user } from "../lib/db/schema";
import { createEveGuestCredential } from "../lib/eve/guest-credential";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");
const owners: string[] = [];
afterAll(async () => {
  if (owners.length) {
    await db
      .delete(eveConversation)
      .where(inArray(eveConversation.ownerId, owners));
    await db.delete(user).where(inArray(user.id, owners));
  }
});

test("expired root claims are bounded, disjoint, fair and preserve owner identities", async () => {
  const guest = await createEveGuest({
    expiresAt: new Date(Date.now() + 60_000),
    messageLimit: 10,
    tokenHash: createEveGuestCredential().tokenHash,
  });
  owners.push(guest.ownerId);
  const roots = Array.from({ length: 11 }, () => ({
    firstMessage: "cleanup fixture",
    id: crypto.randomUUID(),
    operationId: crypto.randomUUID(),
    ownerId: guest.ownerId,
  }));
  await db.insert(eveConversation).values(roots);
  const registeredOwner = crypto.randomUUID();
  owners.push(registeredOwner);
  await db.insert(user).values({
    email: `${registeredOwner}@cleanup.test`,
    id: registeredOwner,
    name: "Cleanup fixture",
  });
  const excluded = [
    crypto.randomUUID(),
    crypto.randomUUID(),
    crypto.randomUUID(),
  ];
  await db.insert(eveConversation).values([
    {
      ...roots[0],
      id: excluded[0],
      operationId: crypto.randomUUID(),
      state: "deleted",
    },
    {
      ...roots[0],
      forkTurnId: "turn_0",
      id: excluded[1],
      operationId: crypto.randomUUID(),
      parentConversationId: roots[0].id,
      rootConversationId: roots[0].id,
    },
    {
      ...roots[0],
      id: excluded[2],
      operationId: crypto.randomUUID(),
      ownerId: registeredOwner,
    },
  ]);
  expect(
    (await claimExpiredEveGuestFamilies()).some(
      (row) => row.ownerId === guest.ownerId
    )
  ).toBe(false);
  await db
    .update(eveGuest)
    .set({ expiresAt: new Date(0) })
    .where(eq(eveGuest.ownerId, guest.ownerId));
  const claimed: string[] = [];
  // Other expired local fixtures may exist; each call remains bounded and rotates fairly.
  for (let round = 0; round < 30 && claimed.length < roots.length; round += 1) {
    const batches = await Promise.all([
      claimExpiredEveGuestFamilies(),
      claimExpiredEveGuestFamilies(),
    ]);
    for (const batch of batches) {
      expect(batch.length).toBeLessThanOrEqual(1);
      expect(batch.some((row) => excluded.includes(row.id))).toBe(false);
      claimed.push(
        ...batch
          .filter((row) => row.ownerId === guest.ownerId)
          .map((row) => row.id)
      );
    }
  }
  expect(new Set(claimed).size).toBe(11);
  expect(claimed).toHaveLength(11);
  expect(
    await db.select().from(eveGuest).where(eq(eveGuest.ownerId, guest.ownerId))
  ).toHaveLength(1);
  expect(
    await db.select().from(user).where(eq(user.id, guest.ownerId))
  ).toHaveLength(1);
  const [first] = roots;
  await db
    .update(eveConversation)
    .set({ guestCleanupAttemptedAt: new Date(0) })
    .where(eq(eveConversation.id, first.id));
  expect((await claimExpiredEveGuestFamilies()).map((row) => row.id)).toContain(
    first.id
  );
});
