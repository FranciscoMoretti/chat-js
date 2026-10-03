/* oxlint-disable import/max-dependencies, import/no-relative-parent-imports --
 * import/max-dependencies (#524): import from "drizzle-orm" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/eve-billing"; "../lib/db/eve-guests"; "../lib/db/eve-queries"; "../lib/db/eve-response-groups" dependency within this package instead of introducing an alias or barrel API.
 */
/* oxlint-disable eslint/func-style -- Hoisted test helpers keep scenario setup readable and stable. */
/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
/* oxlint-disable eslint/require-await -- Async mocks preserve the Promise-returning production callback contract. */
import { eq, inArray } from "drizzle-orm";
import { afterAll, expect, test, vi } from "vitest";

import { db } from "../lib/db/client";
import { recordEveUsage } from "../lib/db/eve-billing";
import {
  commitEveGuestMessage,
  createEveGuest,
  releaseEveGuestCreation,
  releaseEveGuestMessage,
  reserveEveGuestMessage,
  reserveEveGuestMessages,
} from "../lib/db/eve-guests";
import { createEveConversation } from "../lib/db/eve-queries";
import { reserveEveResponseGroupInTransaction } from "../lib/db/eve-response-groups";
import {
  eveConversation,
  eveGuest,
  eveGuestMessage,
  eveGuestRate,
  eveUsage,
  session,
  user,
  userCredit,
} from "../lib/db/schema";
import { env } from "../lib/env";
import {
  createEveGuestCredential,
  eveGuestOwnerId,
} from "../lib/eve/guest-credential";
import { eveResponseGroupCandidates } from "../lib/eve/response-group-candidates";
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable import/max-dependencies, import/no-relative-parent-imports */

assertEveTestDatabase(env.DATABASE_URL);
const owners: string[] = [];
const ips: string[] = [];

/* oxlint-disable no-undefined, typescript/explicit-function-return-type, typescript/strict-boolean-expressions --
 * no-undefined (#519): findEveGuest uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/explicit-function-return-type (#560): Keep findEveGuest's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/strict-boolean-expressions (#610): findEveGuest intentionally keeps the existing falsy-value behavior of row; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
async function findEveGuest(tokenHash: string) {
  const [row] = await db
    .select()
    .from(eveGuest)
    .where(eq(eveGuest.tokenHash, tokenHash));
  return row && row.expiresAt > new Date() ? row : undefined;
}
/* oxlint-enable no-undefined, typescript/explicit-function-return-type, typescript/strict-boolean-expressions */

/* oxlint-disable no-magic-numbers, typescript/explicit-function-return-type --
 * no-magic-numbers (#517): guest uses 10, 60_000 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/explicit-function-return-type (#560): Keep guest's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
async function guest(messageLimit = 10) {
  const credential = createEveGuestCredential();
  const row = await createEveGuest({
    expiresAt: new Date(Date.now() + 60_000),
    messageLimit,
    tokenHash: credential.tokenHash,
  });
  owners.push(row.ownerId);
  return row;
}
/* oxlint-enable no-magic-numbers, typescript/explicit-function-return-type */

/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep request's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
function request(ownerId: string) {
  const ipHash = createEveGuestCredential().tokenHash;
  ips.push(ipHash);
  return {
    ipHash,
    operationId: crypto.randomUUID(),
    ownerId,
    requestHash: createEveGuestCredential().tokenHash,
    requestsPerMinute: 100,
    requestsPerMonth: 100,
  };
}
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): afterAll uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
afterAll(async () => {
  if (owners.length > 0) {
    await db.delete(eveUsage).where(inArray(eveUsage.ownerId, owners));
    await db
      .delete(eveConversation)
      .where(inArray(eveConversation.ownerId, owners));
    await db.delete(user).where(inArray(user.id, owners));
  }
  if (ips.length > 0) {
    await db.delete(eveGuestRate).where(inArray(eveGuestRate.ipHash, ips));
  }
});
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test("guest identity is server-owned, expires and grants no BetterAuth session or sig uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("guest identity is server-owned, expires and grants no BetterAuth session or signup credits", async () => {
  const row = await guest();
  const guestIdentity = await findEveGuest(row.tokenHash);
  expect(guestIdentity?.ownerId).toBe(row.ownerId);
  expect(
    await findEveGuest(createEveGuestCredential().tokenHash)
  ).toBeUndefined();
  expect(
    await db.select().from(userCredit).where(eq(userCredit.userId, row.ownerId))
  ).toEqual([]);
  expect(
    await db.select().from(session).where(eq(session.userId, row.ownerId))
  ).toEqual([]);
  await db
    .update(eveGuest)
    .set({ expiresAt: new Date(0) })
    .where(eq(eveGuest.ownerId, row.ownerId));
  expect(await findEveGuest(row.tokenHash)).toBeUndefined();
  expect(await reserveEveGuestMessage(request(row.ownerId))).toEqual({
    status: "unavailable",
  });
});
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * no-magic-numbers (#517): test("concurrent replay reserves once and rejects changed request content") uses 1, 7, 9 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("concurrent replay reserves once and rejects changed request content") accepts rate; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("concurrent replay reserves once and rejects changed request content") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("concurrent replay reserves once and rejects changed request content", async () => {
  const row = await guest();
  const input = request(row.ownerId);
  const attempts = await Promise.all(
    Array.from({ length: 8 }, () => reserveEveGuestMessage(input))
  );
  expect(
    attempts.filter((result) => result.status === "reserved")
  ).toHaveLength(1);
  expect(attempts.filter((result) => result.status === "replay")).toHaveLength(
    7
  );
  const guestAfterReplay = await findEveGuest(row.tokenHash);
  expect(guestAfterReplay?.remainingMessages).toBe(9);
  const rates = await db
    .select()
    .from(eveGuestRate)
    .where(eq(eveGuestRate.ipHash, input.ipHash));
  expect(rates.map((rate) => rate.requests)).toEqual([1, 1]);
  expect(
    await reserveEveGuestMessage({
      ...input,
      requestHash: createEveGuestCredential().tokenHash,
    })
  ).toEqual({ status: "conflict" });
});
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable no-magic-numbers, typescript/promise-function-async --
 * no-magic-numbers (#517): test("distinct concurrent sends cannot overspend the guest balance") uses 1, 5, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/promise-function-async (#606): test("distinct concurrent sends cannot overspend the guest balance") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("distinct concurrent sends cannot overspend the guest balance", async () => {
  const row = await guest(1);
  const input = request(row.ownerId);
  const results = await Promise.all(
    Array.from({ length: 6 }, () =>
      reserveEveGuestMessage({ ...input, operationId: crypto.randomUUID() })
    )
  );
  expect(results.filter((result) => result.status === "reserved")).toHaveLength(
    1
  );
  expect(
    results.filter((result) => result.status === "exhausted")
  ).toHaveLength(5);
  const guestAfterCompetingSends = await findEveGuest(row.tokenHash);
  expect(guestAfterCompetingSends?.remainingMessages).toBe(0);
});
/* oxlint-enable no-magic-numbers, typescript/promise-function-async */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types --
 * no-magic-numbers (#517): test("IP quotas survive cookie replacement and rejected limits spend no guest balance uses 10, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("IP quotas survive cookie replacement and rejected limits spend no guest balance accepts rate; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
test("IP quotas survive cookie replacement and rejected limits spend no guest balance", async () => {
  const first = await guest();
  const second = await guest();
  const input = { ...request(first.ownerId), requestsPerMonth: 1 };
  const initialReservation = await reserveEveGuestMessage(input);
  expect(initialReservation.status).toBe("reserved");
  expect(
    await reserveEveGuestMessage({
      ...input,
      operationId: crypto.randomUUID(),
      ownerId: second.ownerId,
    })
  ).toEqual({ status: "rate-limited" });
  const secondGuestAfterRateLimit = await findEveGuest(second.tokenHash);
  expect(secondGuestAfterRateLimit?.remainingMessages).toBe(10);
  const ipQuotaRowsAfterLimit = await db
    .select()
    .from(eveGuestRate)
    .where(eq(eveGuestRate.ipHash, input.ipHash));
  expect(ipQuotaRowsAfterLimit.map((rate) => rate.requests)).toEqual([1, 1]);
});
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types */

test("simultaneous guests share one IP admission limit", async () => {
  const first = await guest();
  const second = await guest();
  const input = { ...request(first.ownerId), requestsPerMinute: 1 };
  const results = await Promise.all([
    reserveEveGuestMessage(input),
    reserveEveGuestMessage({
      ...input,
      operationId: crypto.randomUUID(),
      ownerId: second.ownerId,
    }),
  ]);
  expect(results.map((result) => result.status).toSorted()).toEqual([
    "rate-limited",
    "reserved",
  ]);
});

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/promise-function-async --
 * max-lines-per-function (#510): test("refund is once-only, owner-scoped, and a stale attempt cannot refund its retry" keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("refund is once-only, owner-scoped, and a stale attempt cannot refund its retry" keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("refund is once-only, owner-scoped, and a stale attempt cannot refund its retry" uses 1, 10, 9 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/promise-function-async (#606): test("refund is once-only, owner-scoped, and a stale attempt cannot refund its retry" preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("refund is once-only, owner-scoped, and a stale attempt cannot refund its retry", async () => {
  const row = await guest();
  const other = await guest();
  const input = request(row.ownerId);
  const first = await reserveEveGuestMessage(input);
  if (first.status !== "reserved") {
    throw new Error("Expected a reservation");
  }
  expect(
    await releaseEveGuestMessage(
      other.ownerId,
      input.operationId,
      first.reservationId
    )
  ).toBe(false);
  const releases = await Promise.all(
    Array.from({ length: 6 }, () =>
      releaseEveGuestMessage(
        row.ownerId,
        input.operationId,
        first.reservationId
      )
    )
  );
  expect(releases.filter(Boolean)).toHaveLength(1);
  const guestAfterConcurrentRelease = await findEveGuest(row.tokenHash);
  expect(guestAfterConcurrentRelease?.remainingMessages).toBe(10);
  const retry = await reserveEveGuestMessage(input);
  if (retry.status !== "reserved") {
    throw new Error("Expected a retry reservation");
  }
  expect(retry.reservationId).not.toBe(first.reservationId);
  expect(
    await releaseEveGuestMessage(
      row.ownerId,
      input.operationId,
      first.reservationId
    )
  ).toBe(false);
  expect(
    await commitEveGuestMessage(
      row.ownerId,
      input.operationId,
      retry.reservationId
    )
  ).toBe(true);
  expect(
    await releaseEveGuestMessage(
      row.ownerId,
      input.operationId,
      retry.reservationId
    )
  ).toBe(false);
  const guestAfterRetryCommit = await findEveGuest(row.tokenHash);
  expect(guestAfterRetryCommit?.remainingMessages).toBe(9);
});
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/promise-function-async */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test("committing and releasing the same attempt are mutually exclusive") uses 1, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("committing and releasing the same attempt are mutually exclusive", async () => {
  const row = await guest(1);
  const input = request(row.ownerId);
  const held = await reserveEveGuestMessage(input);
  if (held.status !== "reserved") {
    throw new Error("Expected a reservation");
  }
  const results = await Promise.all([
    commitEveGuestMessage(row.ownerId, input.operationId, held.reservationId),
    releaseEveGuestMessage(row.ownerId, input.operationId, held.reservationId),
  ]);
  expect(results.filter(Boolean)).toHaveLength(1);
  const guestAfterCommitReleaseRace = await findEveGuest(row.tokenHash);
  expect(guestAfterCommitReleaseRace?.remainingMessages).toBe(
    results[0] ? 0 : 1
  );
});
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers, typescript/promise-function-async --
 * no-magic-numbers (#517): test("guest provider accounting survives expiry and replay without creating monetary  uses 0, 1, 0.002 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/promise-function-async (#606): test("guest provider accounting survives expiry and replay without creating monetary  preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("guest provider accounting survives expiry and replay without creating monetary credit", async () => {
  const row = await guest();
  await db
    .update(eveGuest)
    .set({ expiresAt: new Date(0) })
    .where(eq(eveGuest.ownerId, row.ownerId));
  const evidence = {
    eventId: crypto.randomUUID(),
    ownerId: row.ownerId,
    sessionId: crypto.randomUUID(),
    turnId: "turn_0",
  };
  expect(await recordEveUsage(evidence)).toBe(false);
  await Promise.all(
    Array.from({ length: 6 }, () =>
      recordEveUsage({ ...evidence, costUsd: 0.002 })
    )
  );
  const rows = await db
    .select()
    .from(eveUsage)
    .where(eq(eveUsage.eventId, evidence.eventId));
  expect(rows).toHaveLength(1);
  expect(Number(rows[0].costUsd)).toBe(0.002);
  expect(rows[0].chargedCents).toBe(0);
  expect(
    await db.select().from(userCredit).where(eq(userCredit.userId, row.ownerId))
  ).toEqual([]);
});
/* oxlint-enable no-magic-numbers, typescript/promise-function-async */

/* oxlint-disable max-statements, no-magic-numbers, typescript/promise-function-async --
 * max-statements (#512): test("first admission creates one guest and reserves once across different IPs") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("first admission creates one guest and reserves once across different IPs") uses 60_000, 1, 5 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/promise-function-async (#606): test("first admission creates one guest and reserves once across different IPs") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("first admission creates one guest and reserves once across different IPs", async () => {
  const credential = createEveGuestCredential();
  const ownerId = eveGuestOwnerId(credential.tokenHash);
  owners.push(ownerId);
  const input = request(ownerId);
  const bootstrap = {
    expiresAt: new Date(Date.now() + 60_000),
    messageLimit: 2,
    tokenHash: credential.tokenHash,
  };
  const attempts = await Promise.all(
    Array.from({ length: 6 }, () => {
      const other = request(ownerId);
      return reserveEveGuestMessage(
        { ...input, ipHash: other.ipHash },
        bootstrap
      );
    })
  );
  expect(
    attempts.filter((result) => result.status === "reserved")
  ).toHaveLength(1);
  expect(attempts.filter((result) => result.status === "replay")).toHaveLength(
    5
  );
  const bootstrappedGuest = await findEveGuest(credential.tokenHash);
  expect(bootstrappedGuest?.remainingMessages).toBe(1);
  expect(await db.select().from(user).where(eq(user.id, ownerId))).toHaveLength(
    1
  );
  expect(
    await db.select().from(userCredit).where(eq(userCredit.userId, ownerId))
  ).toEqual([]);
});
/* oxlint-enable max-statements, no-magic-numbers, typescript/promise-function-async */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test("denied first admission creates no account or quota rows") uses 0, 100, 60_000, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("denied first admission creates no account or quota rows", async () => {
  for (const denial of ["rate", "balance"] as const) {
    const credential = createEveGuestCredential();
    const ownerId = eveGuestOwnerId(credential.tokenHash);
    owners.push(ownerId);
    const input = request(ownerId);
    const result = await reserveEveGuestMessage(
      {
        ...input,
        requestsPerMinute: denial === "rate" ? 0 : 100,
      },
      {
        expiresAt: new Date(Date.now() + 60_000),
        messageLimit: denial === "balance" ? 0 : 2,
        tokenHash: credential.tokenHash,
      }
    );
    expect(result.status).toBe(
      denial === "rate" ? "rate-limited" : "exhausted"
    );
    expect(await findEveGuest(credential.tokenHash)).toBeUndefined();
    expect(await db.select().from(user).where(eq(user.id, ownerId))).toEqual(
      []
    );
    expect(
      await db
        .select()
        .from(eveGuestRate)
        .where(eq(eveGuestRate.ipHash, input.ipHash))
    ).toEqual([]);
  }
});
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers, unicorn/max-nested-calls --
 * no-magic-numbers (#517): test("bootstrap cannot replace an expired identity or reset its balance") uses 1, 60_000, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * unicorn/max-nested-calls (#568): test("bootstrap cannot replace an expired identity or reset its balance") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
test("bootstrap cannot replace an expired identity or reset its balance", async () => {
  const row = await guest(1);
  const input = request(row.ownerId);
  await reserveEveGuestMessage(input);
  const bootstrap = {
    expiresAt: new Date(Date.now() + 60_000),
    messageLimit: 50,
    tokenHash: row.tokenHash,
  };
  const expiredBootstrapReservation = await reserveEveGuestMessage(
    request(row.ownerId),
    bootstrap
  );
  expect(expiredBootstrapReservation.status).toBe("exhausted");
  await db
    .update(eveGuest)
    .set({ expiresAt: new Date(0) })
    .where(eq(eveGuest.ownerId, row.ownerId));
  const repeatedBootstrapReservation = await reserveEveGuestMessage(
    request(row.ownerId),
    bootstrap
  );
  expect(repeatedBootstrapReservation.status).toBe("unavailable");
  await expect(
    reserveEveGuestMessage(request(crypto.randomUUID()), bootstrap)
  ).rejects.toThrow("Invalid guest admission");
});
/* oxlint-enable no-magic-numbers, unicorn/max-nested-calls */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test("comparison admission rolls back a fresh account when any candidate exceeds quot uses 60_000 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("comparison admission rolls back a fresh account when any candidate exceeds quota", async () => {
  const credential = createEveGuestCredential();
  const ownerId = eveGuestOwnerId(credential.tokenHash);
  owners.push(ownerId);
  const first = request(ownerId);
  const result = await reserveEveGuestMessages(
    [first, { ...first, operationId: crypto.randomUUID() }],
    {
      expiresAt: new Date(Date.now() + 60_000),
      messageLimit: 1,
      tokenHash: credential.tokenHash,
    }
  );
  expect(result).toEqual({ status: "exhausted" });
  expect(await db.select().from(user).where(eq(user.id, ownerId))).toEqual([]);
  expect(
    await db
      .select()
      .from(eveGuestMessage)
      .where(eq(eveGuestMessage.ownerId, ownerId))
  ).toEqual([]);
  expect(
    await db
      .select()
      .from(eveGuestRate)
      .where(eq(eveGuestRate.ipHash, first.ipHash))
  ).toEqual([]);
});
/* oxlint-enable no-magic-numbers */

/* oxlint-disable max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types --
 * max-statements (#512): test("failed mixed replay/new comparison leaves prior admission intact and rolls back keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("failed mixed replay/new comparison leaves prior admission intact and rolls back uses 2, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("failed mixed replay/new comparison leaves prior admission intact and rolls back accepts bucket; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
test("failed mixed replay/new comparison leaves prior admission intact and rolls back new debits", async () => {
  const row = await guest(2);
  const first = request(row.ownerId);
  const accepted = await reserveEveGuestMessage(first);
  expect(accepted.status).toBe("reserved");
  const result = await reserveEveGuestMessages([
    first,
    { ...first, operationId: crypto.randomUUID() },
    { ...first, operationId: crypto.randomUUID() },
  ]);
  expect(result).toEqual({ status: "exhausted" });
  expect(await reserveEveGuestMessage(first)).toEqual({
    ...accepted,
    status: "replay",
  });
  const guestAfterMixedReplay = await findEveGuest(row.tokenHash);
  expect(guestAfterMixedReplay?.remainingMessages).toBe(1);
  const entries = await db
    .select()
    .from(eveGuestMessage)
    .where(eq(eveGuestMessage.ownerId, row.ownerId));
  expect(entries).toHaveLength(1);
  const ipQuotaRowsAfterRollback = await db
    .select()
    .from(eveGuestRate)
    .where(eq(eveGuestRate.ipHash, first.ipHash));
  expect(ipQuotaRowsAfterRollback.map((bucket) => bucket.requests)).toEqual([
    1, 1,
  ]);
});
/* oxlint-enable max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * max-statements (#512): test("concurrent comparison retries debit each distinct candidate exactly once") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("concurrent comparison retries debit each distinct candidate exactly once") uses 2, 1, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("concurrent comparison retries debit each distinct candidate exactly once") accepts entry; result; bucket; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("concurrent comparison retries debit each distinct candidate exactly once") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("concurrent comparison retries debit each distinct candidate exactly once", async () => {
  const row = await guest(2);
  const first = request(row.ownerId);
  const inputs = [first, { ...first, operationId: crypto.randomUUID() }];
  const results = await Promise.all(
    Array.from({ length: 4 }, () => reserveEveGuestMessages(inputs))
  );
  for (const result of results) {
    expect(result.status).toBe("admitted");
    if (result.status !== "admitted") {
      throw new Error("Comparison admission failed.");
    }
    expect(result.reservations.map((entry) => entry.operationId)).toEqual(
      inputs.map((entry) => entry.operationId)
    );
  }
  expect(
    results.filter(
      (result) =>
        result.status === "admitted" &&
        result.reservations.every((entry) => entry.status === "reserved")
    )
  ).toHaveLength(1);
  const guestAfterConcurrentComparison = await findEveGuest(row.tokenHash);
  expect(guestAfterConcurrentComparison?.remainingMessages).toBe(0);
  const ipQuotaRowsAfterComparison = await db
    .select()
    .from(eveGuestRate)
    .where(eq(eveGuestRate.ipHash, first.ipHash));
  expect(ipQuotaRowsAfterComparison.map((bucket) => bucket.requests)).toEqual([
    2, 2,
  ]);
});
/* oxlint-enable max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test("comparison rate limits roll back all candidates and reject duplicate operation  uses 10 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("comparison rate limits roll back all candidates and reject duplicate operation IDs", async () => {
  const row = await guest(10);
  const first = { ...request(row.ownerId), requestsPerMinute: 1 };
  expect(
    await reserveEveGuestMessages([
      first,
      { ...first, operationId: crypto.randomUUID() },
    ])
  ).toEqual({ status: "rate-limited" });
  const guestAfterComparisonRateLimit = await findEveGuest(row.tokenHash);
  expect(guestAfterComparisonRateLimit?.remainingMessages).toBe(10);
  expect(
    await db
      .select()
      .from(eveGuestMessage)
      .where(eq(eveGuestMessage.ownerId, row.ownerId))
  ).toEqual([]);
  await expect(reserveEveGuestMessages([first, first])).rejects.toThrow(
    "unique operations"
  );
  await expect(
    reserveEveGuestMessages([
      first,
      { ...first, operationId: first.operationId.toUpperCase() },
    ])
  ).rejects.toThrow("unique operations");
});
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, unicorn/max-nested-calls --
 * no-magic-numbers (#517): test("comparison persistence failure rolls back guest identity and every quota reserv uses 60_000 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("comparison persistence failure rolls back guest identity and every quota reserv accepts candidate; tx; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("comparison persistence failure rolls back guest identity and every quota reserv preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * unicorn/max-nested-calls (#568): test("comparison persistence failure rolls back guest identity and every quota reserv keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
test("comparison persistence failure rolls back guest identity and every quota reservation", async () => {
  const credential = createEveGuestCredential();
  const ownerId = eveGuestOwnerId(credential.tokenHash);
  owners.push(ownerId);
  const first = request(ownerId);
  const input = {
    fork: { beforeTurnId: "turn_0", conversationId: crypto.randomUUID() },
    message: "hello",
    modelIds: ["cheap", "cheap"],
    operationId: crypto.randomUUID(),
  };
  const candidates = eveResponseGroupCandidates(
    input.operationId,
    input.modelIds
  );
  await expect(
    reserveEveGuestMessages(
      // oxlint-disable-next-line oxc/no-map-spread -- #541: Each guest candidate needs a distinct reservation fixture while preserving the shared first reservation.
      candidates.map((candidate) => ({
        ...first,
        operationId: candidate.operationId,
      })),
      {
        expiresAt: new Date(Date.now() + 60_000),
        messageLimit: 2,
        tokenHash: credential.tokenHash,
      },
      (tx) => reserveEveResponseGroupInTransaction(tx, ownerId, input)
    )
  ).rejects.toThrow("Source conversation not found");
  expect(await db.select().from(user).where(eq(user.id, ownerId))).toEqual([]);
  expect(
    await db
      .select()
      .from(eveGuestMessage)
      .where(eq(eveGuestMessage.ownerId, ownerId))
  ).toEqual([]);
  expect(
    await db
      .select()
      .from(eveGuestRate)
      .where(eq(eveGuestRate.ipHash, first.ipHash))
  ).toEqual([]);
});
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, unicorn/max-nested-calls */

/* oxlint-disable max-statements, no-magic-numbers --
 * max-statements (#512): test("refunded guest creation cannot dispatch late, while a new admission can recover keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("refunded guest creation cannot dispatch late, while a new admission can recover uses 1, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("refunded guest creation cannot dispatch late, while a new admission can recover", async () => {
  const row = await guest(1);
  const input = request(row.ownerId);
  const original = await reserveEveGuestMessage(input);
  if (original.status !== "reserved") {
    throw new Error("Missing admission");
  }
  expect(
    await releaseEveGuestCreation(
      row.ownerId,
      input.operationId,
      original.reservationId
    )
  ).toBe(true);
  const dispatch = vi.fn(async () => `native-${input.operationId}`);
  await expect(
    createEveConversation(row.ownerId, input.operationId, "hello", dispatch, {
      guestReservationId: original.reservationId,
    })
  ).rejects.toThrow("Guest admission has changed");
  await expect(
    createEveConversation(row.ownerId, input.operationId, "hello", dispatch)
  ).rejects.toThrow("requires a quota reservation");
  expect(dispatch).not.toHaveBeenCalled();
  const retry = await reserveEveGuestMessage(input);
  if (retry.status !== "reserved") {
    throw new Error("Missing retry admission");
  }
  const binding = await createEveConversation(
    row.ownerId,
    input.operationId,
    "hello",
    dispatch,
    { guestReservationId: retry.reservationId }
  );
  expect(binding.sessionId).toBe(`native-${input.operationId}`);
  expect(
    await releaseEveGuestCreation(
      row.ownerId,
      input.operationId,
      retry.reservationId
    )
  ).toBe(false);
  const guestAfterCreationRefund = await findEveGuest(row.tokenHash);
  expect(guestAfterCreationRefund?.remainingMessages).toBe(0);
  expect(dispatch).toHaveBeenCalledTimes(1);
});
/* oxlint-enable max-statements, no-magic-numbers */

/* oxlint-disable max-statements, no-magic-numbers --
 * max-statements (#512): test("creation claims and refunds serialize without a free native dispatch") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("creation claims and refunds serialize without a free native dispatch") uses 4, 1, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("creation claims and refunds serialize without a free native dispatch", async () => {
  for (let index = 0; index < 4; index += 1) {
    const row = await guest(1);
    const input = request(row.ownerId);
    const quota = await reserveEveGuestMessage(input);
    if (quota.status !== "reserved") {
      throw new Error("Missing admission");
    }
    const dispatch = vi.fn(async () => `native-race-${input.operationId}`);
    const [creation, refund] = await Promise.allSettled([
      createEveConversation(row.ownerId, input.operationId, "hello", dispatch, {
        guestReservationId: quota.reservationId,
      }),
      releaseEveGuestCreation(
        row.ownerId,
        input.operationId,
        quota.reservationId
      ),
    ]);
    expect(refund.status).toBe("fulfilled");
    if (refund.status !== "fulfilled") {
      throw new Error("Refund failed");
    }
    if (refund.value) {
      expect(creation.status).toBe("rejected");
      expect(dispatch).not.toHaveBeenCalled();
      const guestAfterRefundWins = await findEveGuest(row.tokenHash);
      expect(guestAfterRefundWins?.remainingMessages).toBe(1);
    } else {
      expect(creation.status).toBe("fulfilled");
      expect(dispatch).toHaveBeenCalledTimes(1);
      const guestAfterCreationWins = await findEveGuest(row.tokenHash);
      expect(guestAfterCreationWins?.remainingMessages).toBe(0);
    }
  }
});
/* oxlint-enable max-statements, no-magic-numbers */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test("committed quota without a creation journal cannot authorize a new dispatch") uses 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("committed quota without a creation journal cannot authorize a new dispatch", async () => {
  const row = await guest(1);
  const input = request(row.ownerId);
  const quota = await reserveEveGuestMessage(input);
  if (quota.status !== "reserved") {
    throw new Error("Missing admission");
  }
  await commitEveGuestMessage(
    row.ownerId,
    input.operationId,
    quota.reservationId
  );
  const dispatch = vi.fn(async () => `native-${input.operationId}`);
  await expect(
    createEveConversation(row.ownerId, input.operationId, "hello", dispatch, {
      guestReservationId: quota.reservationId,
    })
  ).rejects.toThrow("Committed guest admission has no creation journal");
  expect(dispatch).not.toHaveBeenCalled();
});
/* oxlint-enable no-magic-numbers */

/* oxlint-disable max-lines -- #509: This eve-guests.e2e.ts module keeps its existing fixture/scenario boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric. */
