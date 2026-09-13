/* oxlint-disable eslint/func-style -- Hoisted test helpers keep scenario setup readable and stable. */
/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
/* oxlint-disable eslint/require-await -- Async mocks preserve the Promise-returning production callback contract. */
/* oxlint-disable unicorn/no-await-expression-member -- Direct awaited assertions keep each test action tied to its expectation. */
import { eq, inArray } from "drizzle-orm";
import { afterAll, expect, test, vi } from "vitest";

import { db } from "../lib/db/client";
import { recordEveUsage } from "../lib/db/eve-billing";
import {
  commitEveGuestMessage,
  createEveGuest,
  readEveGuestCredential,
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

assertEveTestDatabase(env.DATABASE_URL);
const owners: string[] = [];
const ips: string[] = [];

async function findEveGuest(tokenHash: string) {
  const result = await readEveGuestCredential(tokenHash);
  return result.status === "active" ? result.guest : undefined;
}

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

afterAll(async () => {
  if (owners.length) {
    await db.delete(eveUsage).where(inArray(eveUsage.ownerId, owners));
    await db
      .delete(eveConversation)
      .where(inArray(eveConversation.ownerId, owners));
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
      operationId: crypto.randomUUID(),
      ownerId: second.ownerId,
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
      operationId: crypto.randomUUID(),
      ownerId: second.ownerId,
    }),
  ]);
  expect(results.map((result) => result.status).toSorted()).toEqual([
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
  expect((await findEveGuest(credential.tokenHash))?.remainingMessages).toBe(1);
  expect(await db.select().from(user).where(eq(user.id, ownerId))).toHaveLength(
    1
  );
  expect(
    await db.select().from(userCredit).where(eq(userCredit.userId, ownerId))
  ).toEqual([]);
});

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
    expect(await readEveGuestCredential(credential.tokenHash)).toEqual({
      status: "missing",
    });
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

test("bootstrap cannot replace an expired identity or reset its balance", async () => {
  const row = await guest(1);
  const input = request(row.ownerId);
  await reserveEveGuestMessage(input);
  const bootstrap = {
    expiresAt: new Date(Date.now() + 60_000),
    messageLimit: 50,
    tokenHash: row.tokenHash,
  };
  expect(
    (await reserveEveGuestMessage(request(row.ownerId), bootstrap)).status
  ).toBe("exhausted");
  await db
    .update(eveGuest)
    .set({ expiresAt: new Date(0) })
    .where(eq(eveGuest.ownerId, row.ownerId));
  expect(
    (await reserveEveGuestMessage(request(row.ownerId), bootstrap)).status
  ).toBe("unavailable");
  await expect(
    reserveEveGuestMessage(request(crypto.randomUUID()), bootstrap)
  ).rejects.toThrow("Invalid guest admission");
});

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
  expect((await findEveGuest(row.tokenHash))?.remainingMessages).toBe(1);
  const entries = await db
    .select()
    .from(eveGuestMessage)
    .where(eq(eveGuestMessage.ownerId, row.ownerId));
  expect(entries).toHaveLength(1);
  expect(
    (
      await db
        .select()
        .from(eveGuestRate)
        .where(eq(eveGuestRate.ipHash, first.ipHash))
    ).map((bucket) => bucket.requests)
  ).toEqual([1, 1]);
});

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
  expect((await findEveGuest(row.tokenHash))?.remainingMessages).toBe(0);
  expect(
    (
      await db
        .select()
        .from(eveGuestRate)
        .where(eq(eveGuestRate.ipHash, first.ipHash))
    ).map((bucket) => bucket.requests)
  ).toEqual([2, 2]);
});

test("comparison rate limits roll back all candidates and reject duplicate operation IDs", async () => {
  const row = await guest(10);
  const first = { ...request(row.ownerId), requestsPerMinute: 1 };
  expect(
    await reserveEveGuestMessages([
      first,
      { ...first, operationId: crypto.randomUUID() },
    ])
  ).toEqual({ status: "rate-limited" });
  expect((await findEveGuest(row.tokenHash))?.remainingMessages).toBe(10);
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
  expect((await findEveGuest(row.tokenHash))?.remainingMessages).toBe(0);
  expect(dispatch).toHaveBeenCalledTimes(1);
});

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
      expect((await findEveGuest(row.tokenHash))?.remainingMessages).toBe(1);
    } else {
      expect(creation.status).toBe("fulfilled");
      expect(dispatch).toHaveBeenCalledTimes(1);
      expect((await findEveGuest(row.tokenHash))?.remainingMessages).toBe(0);
    }
  }
});

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
