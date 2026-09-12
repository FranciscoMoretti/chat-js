import { eq, inArray } from "drizzle-orm";
import { afterAll, expect, test } from "vitest";
import { db } from "../lib/db/client";
import { recordEveUsage } from "../lib/db/eve-billing";
import {
  commitEveGuestMessage,
  createEveGuest,
  findEveGuest,
  releaseEveGuestMessage,
  reserveEveGuestMessage,
} from "../lib/db/eve-guests";
import {
  eveGuest,
  eveGuestRate,
  eveUsage,
  session,
  user,
  userCredit,
} from "../lib/db/schema";
import { env } from "../lib/env";
import { createEveGuestCredential } from "../lib/eve/guest-credential";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(env.DATABASE_URL);
const owners: string[] = [];
const ips: string[] = [];

async function guest(messageLimit = 10) {
  const credential = createEveGuestCredential();
  const row = await createEveGuest({
    tokenHash: credential.tokenHash,
    messageLimit,
    expiresAt: new Date(Date.now() + 60_000),
  });
  owners.push(row.ownerId);
  return row;
}

function request(ownerId: string) {
  const ipHash = createEveGuestCredential().tokenHash;
  ips.push(ipHash);
  return {
    ownerId,
    operationId: crypto.randomUUID(),
    requestHash: createEveGuestCredential().tokenHash,
    ipHash,
    requestsPerMinute: 100,
    requestsPerMonth: 100,
  };
}

afterAll(async () => {
  if (owners.length) {
    await db.delete(eveUsage).where(inArray(eveUsage.ownerId, owners));
    await db.delete(user).where(inArray(user.id, owners));
  }
  if (ips.length) {
    await db.delete(eveGuestRate).where(inArray(eveGuestRate.ipHash, ips));
  }
});

test("guest identity is server-owned, expires and grants no BetterAuth session or signup credits", async () => {
  const row = await guest();
  expect((await findEveGuest(row.tokenHash))?.ownerId).toBe(row.ownerId);
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
  expect((await findEveGuest(row.tokenHash))?.remainingMessages).toBe(9);
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
  expect((await findEveGuest(row.tokenHash))?.remainingMessages).toBe(0);
});

test("IP quotas survive cookie replacement and rejected limits spend no guest balance", async () => {
  const first = await guest();
  const second = await guest();
  const input = { ...request(first.ownerId), requestsPerMonth: 1 };
  expect((await reserveEveGuestMessage(input)).status).toBe("reserved");
  expect(
    await reserveEveGuestMessage({
      ...input,
      ownerId: second.ownerId,
      operationId: crypto.randomUUID(),
    })
  ).toEqual({ status: "rate-limited" });
  expect((await findEveGuest(second.tokenHash))?.remainingMessages).toBe(10);
  expect(
    (
      await db
        .select()
        .from(eveGuestRate)
        .where(eq(eveGuestRate.ipHash, input.ipHash))
    ).map((rate) => rate.requests)
  ).toEqual([1, 1]);
});

test("simultaneous guests share one IP admission limit", async () => {
  const first = await guest();
  const second = await guest();
  const input = { ...request(first.ownerId), requestsPerMinute: 1 };
  const results = await Promise.all([
    reserveEveGuestMessage(input),
    reserveEveGuestMessage({
      ...input,
      ownerId: second.ownerId,
      operationId: crypto.randomUUID(),
    }),
  ]);
  expect(results.map((result) => result.status).sort()).toEqual([
    "rate-limited",
    "reserved",
  ]);
});

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
  expect((await findEveGuest(row.tokenHash))?.remainingMessages).toBe(10);
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
  expect((await findEveGuest(row.tokenHash))?.remainingMessages).toBe(9);
});

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
  expect((await findEveGuest(row.tokenHash))?.remainingMessages).toBe(
    results[0] ? 0 : 1
  );
});

test("guest provider accounting survives expiry and replay without creating monetary credit", async () => {
  const row = await guest();
  await db
    .update(eveGuest)
    .set({ expiresAt: new Date(0) })
    .where(eq(eveGuest.ownerId, row.ownerId));
  const evidence = {
    ownerId: row.ownerId,
    eventId: crypto.randomUUID(),
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
