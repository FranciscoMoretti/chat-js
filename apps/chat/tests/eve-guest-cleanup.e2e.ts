/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/eve-guest-cleanup"; "../lib/db/eve-guests"; "../lib/db/schema"; "../lib/eve/guest-credential" dependency within this package instead of introducing an alias or barrel API.
 */
/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
import { eq, inArray } from "drizzle-orm";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { afterAll, expect, test } from "vitest";
/* oxlint-enable sort-imports */

import { db } from "../lib/db/client";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { claimExpiredEveGuestFamilies } from "../lib/db/eve-guest-cleanup";
/* oxlint-enable sort-imports */
import { createEveGuest } from "../lib/db/eve-guests";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { eveConversation, eveGuest, user } from "../lib/db/schema";
/* oxlint-enable sort-imports */
import { createEveGuestCredential } from "../lib/eve/guest-credential";
import { insertEveConversationFixtures } from "./eve-conversation-fixture";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable node/no-process-env --
 * node/no-process-env (#537): assertEveTestDatabase reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 */
assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");
/* oxlint-enable node/no-process-env */
const owners: string[] = [];
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): afterAll uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
afterAll(async () => {
  if (owners.length > 0) {
    await db
      .delete(eveConversation)
      .where(inArray(eveConversation.ownerId, owners));
    await db.delete(user).where(inArray(user.id, owners));
  }
});
/* oxlint-enable no-magic-numbers */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers --
 * max-lines-per-function (#510): test("expired root claims are bounded, disjoint, fair and preserve owner identities") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("expired root claims are bounded, disjoint, fair and preserve owner identities") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("expired root claims are bounded, disjoint, fair and preserve owner identities") uses 60_000, 0, 1, 2, 30, 11 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
  await insertEveConversationFixtures(roots);
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
  expect(expiredGuestClaims.some((row) => row.ownerId === guest.ownerId)).toBe(
    false
  );
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
  const expiredGuestClaimIds = await claimExpiredEveGuestFamilies();
  expect(expiredGuestClaimIds.map((row) => row.id)).toContain(first.id);
});
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers */
