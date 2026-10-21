import { eq, inArray } from "drizzle-orm";
import { afterAll, expect, test } from "vitest";

import { db } from "../lib/db/client";
import {
  claimExpiredEveGuestFamilies,
  hasExpiredEveGuestFamilies,
} from "../lib/db/eve-guest-cleanup";
import { createEveGuest } from "../lib/db/eve-guests";
import { eveConversation, eveGuest, user } from "../lib/db/schema";
import { createEveGuestCredential } from "../lib/eve/guest-credential";
import { insertEveConversationFixtures } from "./eve-conversation-fixture";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");
const owners: string[] = [];
afterAll(async () => {
  if (owners.length > 0) {
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
  const insertedRoots = await insertEveConversationFixtures(roots);
  const registeredOwner = crypto.randomUUID();
  owners.push(registeredOwner);
  await db.insert(user).values({
    email: `${registeredOwner}@cleanup.test`,
    id: registeredOwner,
    name: "Cleanup fixture",
  });
  const excluded: string[] = [
    crypto.randomUUID(),
    crypto.randomUUID(),
    crypto.randomUUID(),
  ];
  await insertEveConversationFixtures([
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
  const expiredGuestClaims = await claimExpiredEveGuestFamilies();
  expect(
    expiredGuestClaims.some(
      (row: { readonly ownerId: string }) => row.ownerId === guest.ownerId
    )
  ).toBe(false);
  await db
    .update(eveGuest)
    .set({ expiresAt: new Date(0) })
    .where(eq(eveGuest.ownerId, guest.ownerId));
  const claimed: string[] = [];
  // Other expired local fixtures may exist; each call remains bounded and rotates fairly.
  /* oxlint-disable eslint/no-await-in-loop -- Each bounded claim round updates claimed families and determines whether another round is needed. */
  for (let round = 0; round < 30 && claimed.length < roots.length; round += 1) {
    const batches = await Promise.all([
      claimExpiredEveGuestFamilies(),
      claimExpiredEveGuestFamilies(),
    ]);
    for (const batch of batches) {
      expect(batch.length).toBeLessThanOrEqual(1);
      expect(
        batch.some((row: { readonly id: string }) => excluded.includes(row.id))
      ).toBe(false);
      claimed.push(
        ...batch
          .filter(
            (row: { readonly ownerId: string }) => row.ownerId === guest.ownerId
          )
          .map((row: { readonly id: string }) => row.id)
      );
    }
  }
  /* oxlint-enable eslint/no-await-in-loop */
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
  const expiredGuestClaimIds = await claimExpiredEveGuestFamilies();
  expect(
    expiredGuestClaimIds.map((row: { readonly id: string }) => row.id)
  ).toContain(insertedRoots[0].chatId);
});

test("expiry selects the whole chat even after its root conversation was deleted", async () => {
  const guest = await createEveGuest({
    expiresAt: new Date(Date.now() + 60_000),
    messageLimit: 10,
    tokenHash: createEveGuestCredential().tokenHash,
  });
  owners.push(guest.ownerId);
  await db
    .update(eveGuest)
    .set({ expiresAt: new Date(0) })
    .where(eq(eveGuest.ownerId, guest.ownerId));
  const [root] = await insertEveConversationFixtures({
    ownerId: guest.ownerId,
    firstMessage: "root",
    operationId: crypto.randomUUID(),
    state: "deleted",
  });
  const [fork] = await insertEveConversationFixtures({
    ownerId: guest.ownerId,
    firstMessage: "fork",
    operationId: crypto.randomUUID(),
    parentConversationId: root.id,
    rootConversationId: root.id,
    forkTurnId: "turn_0",
    state: "bound",
    sessionId: crypto.randomUUID(),
  });
  expect(await hasExpiredEveGuestFamilies()).toBe(true);
  const claims = await claimExpiredEveGuestFamilies();
  expect(claims).toContainEqual({ id: root.chatId, ownerId: guest.ownerId });
  const { beginEveConversationDeletion } =
    await import("../lib/db/eve-queries");
  const deletion = await beginEveConversationDeletion(
    guest.ownerId,
    root.chatId
  );
  expect(deletion?.conversations.map((row) => row.id)).toContain(fork.id);
});
