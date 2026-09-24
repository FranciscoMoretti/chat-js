import { randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { eveGuestOwnerId } from "../eve/guest-credential";
import { db } from "./client";
import {
  eveConversation,
  eveGuest,
  eveGuestMessage,
  eveGuestRate,
  user,
} from "./schema";

const hash = z.string().regex(/^[0-9a-f]{64}$/u);
const reservation = z.object({
  ipHash: hash,
  operationId: z.uuid(),
  ownerId: z.string().min(1),
  requestHash: hash,
  requestsPerMinute: z.number().int().nonnegative(),
  requestsPerMonth: z.number().int().nonnegative(),
});

const windows = (now: Date) =>
  [60, 2_592_000].map((seconds) => ({
    seconds,
    startsAt: new Date(
      Math.floor(now.getTime() / (seconds * 1000)) * seconds * 1000
    ),
  }));

export const createEveGuest = async (input: {
  tokenHash: string;
  messageLimit: number;
  expiresAt: Date;
}) => {
  hash.parse(input.tokenHash);
  z.number().int().nonnegative().parse(input.messageLimit);
  if (
    !Number.isFinite(input.expiresAt.getTime()) ||
    input.expiresAt <= new Date()
  ) {
    throw new Error("Guest expiry must be in the future.");
  }
  return await db.transaction(async (tx) => {
    const ownerId = eveGuestOwnerId(input.tokenHash);
    await tx.insert(user).values({
      email: `${ownerId}@guest.invalid`,
      id: ownerId,
      name: "Guest",
    });
    const [guest] = await tx
      .insert(eveGuest)
      .values({ ...input, ownerId, remainingMessages: input.messageLimit })
      .returning();
    return guest;
  });
};

/** An expired credential must never be mistaken for a not-yet-admitted guest. */
export const readEveGuestCredential = async (tokenHash: string) => {
  if (!hash.safeParse(tokenHash).success) {
    return { status: "invalid" } as const;
  }
  const [guest] = await db
    .select()
    .from(eveGuest)
    .where(eq(eveGuest.tokenHash, tokenHash));
  if (!guest) {
    return { status: "missing" } as const;
  }
  if (guest.expiresAt <= new Date()) {
    return { status: "expired" } as const;
  }
  return { guest, status: "active" } as const;
};

export const readExistingEveGuestMessage = async (
  ownerId: string,
  operationId: string
) => {
  const [message] = await db
    .select({
      requestHash: eveGuestMessage.requestHash,
      reservationId: eveGuestMessage.reservationId,
      state: eveGuestMessage.state,
    })
    .from(eveGuestMessage)
    .where(
      and(
        eq(eveGuestMessage.ownerId, ownerId),
        eq(eveGuestMessage.operationId, operationId)
      )
    );
  return message;
};

type GuestBootstrap = {
  tokenHash: string;
  messageLimit: number;
  expiresAt: Date;
};
type GuestReservationInput = z.infer<typeof reservation>;

const validateReservation = (
  input: GuestReservationInput,
  bootstrap?: GuestBootstrap
) => {
  reservation.parse(input);
  if (bootstrap) {
    hash.parse(bootstrap.tokenHash);
    z.number().int().nonnegative().parse(bootstrap.messageLimit);
    if (
      eveGuestOwnerId(bootstrap.tokenHash) !== input.ownerId ||
      !Number.isFinite(bootstrap.expiresAt.getTime()) ||
      bootstrap.expiresAt <= new Date()
    ) {
      throw new Error("Invalid guest admission identity or expiry.");
    }
  }
};

const rateAvailable = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: {
    ipHash: string;
    requestsPerMinute: number;
    requestsPerMonth: number;
  },
  periods: ReturnType<typeof windows>
) => {
  for (const period of periods) {
    const limit =
      period.seconds === 60 ? input.requestsPerMinute : input.requestsPerMonth;
    // oxlint-disable-next-line eslint/no-await-in-loop -- Keep quota admission and cleanup ordered and bounded.
    const [bucket] = await tx
      .select()
      .from(eveGuestRate)
      .where(
        and(
          eq(eveGuestRate.ipHash, input.ipHash),
          eq(eveGuestRate.windowSeconds, period.seconds),
          eq(eveGuestRate.startsAt, period.startsAt)
        )
      );
    if ((bucket?.requests ?? 0) >= limit) {
      return false;
    }
  }
  return true;
};

const admissionGuest = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: z.infer<typeof reservation>,
  bootstrap:
    | {
        tokenHash: string;
        messageLimit: number;
        expiresAt: Date;
      }
    | undefined,
  now: Date
) => {
  let [guest] = await tx
    .select()
    .from(eveGuest)
    .where(eq(eveGuest.ownerId, input.ownerId))
    .for("update");
  if (!guest && bootstrap) {
    if (bootstrap.expiresAt <= now) {
      return { status: "unavailable" } as const;
    }
    if (bootstrap.messageLimit === 0) {
      return { status: "exhausted" } as const;
    }
    if (!(await rateAvailable(tx, input, windows(now)))) {
      return { status: "rate-limited" } as const;
    }
    await tx.insert(user).values({
      email: `${input.ownerId}@guest.invalid`,
      id: input.ownerId,
      name: "Guest",
    });
    [guest] = await tx
      .insert(eveGuest)
      .values({
        ...bootstrap,
        ownerId: input.ownerId,
        remainingMessages: bootstrap.messageLimit,
      })
      .returning();
  }
  if (!guest || guest.expiresAt <= now) {
    return { status: "unavailable" } as const;
  }
  return { guest, status: "ready" } as const;
};

const reserveMessage = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: GuestReservationInput,
  bootstrap?: GuestBootstrap
) => {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`eve-guest-ip:${input.ipHash}`}))`
  );
  // Serialize first admission even when the same credential arrives from two IPs.
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`eve-guest-owner:${input.ownerId}`}))`
  );
  const now = new Date();
  const admission = await admissionGuest(tx, input, bootstrap, now);
  if (admission.status !== "ready") {
    return admission;
  }
  const { guest } = admission;
  const identity = and(
    eq(eveGuestMessage.ownerId, input.ownerId),
    eq(eveGuestMessage.operationId, input.operationId)
  );
  const [existing] = await tx.select().from(eveGuestMessage).where(identity);
  if (existing && existing.requestHash !== input.requestHash) {
    return { status: "conflict" } as const;
  }
  if (existing && existing.state !== "released") {
    return {
      reservationId: existing.reservationId,
      status: "replay",
    } as const;
  }
  if (guest.remainingMessages === 0) {
    return { status: "exhausted" } as const;
  }
  const periods = windows(now);
  if (!(await rateAvailable(tx, input, periods))) {
    return { status: "rate-limited" } as const;
  }
  for (const period of periods) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Keep quota admission and cleanup ordered and bounded.
    await tx
      .insert(eveGuestRate)
      .values({
        ipHash: input.ipHash,
        requests: 1,
        startsAt: period.startsAt,
        windowSeconds: period.seconds,
      })
      .onConflictDoUpdate({
        set: { requests: sql`${eveGuestRate.requests} + 1` },
        target: [
          eveGuestRate.ipHash,
          eveGuestRate.windowSeconds,
          eveGuestRate.startsAt,
        ],
      });
  }
  await tx
    .update(eveGuest)
    .set({ remainingMessages: sql`${eveGuest.remainingMessages} - 1` })
    .where(eq(eveGuest.ownerId, input.ownerId));
  const reservationId = randomUUID();
  await tx
    .insert(eveGuestMessage)
    .values({
      ipHash: input.ipHash,
      operationId: input.operationId,
      ownerId: input.ownerId,
      requestHash: input.requestHash,
      reservationId,
      reservedAt: now,
      state: "reserved",
    })
    .onConflictDoUpdate({
      set: {
        ipHash: input.ipHash,
        reservationId,
        reservedAt: now,
        state: "reserved",
      },
      target: [eveGuestMessage.ownerId, eveGuestMessage.operationId],
    });
  return { reservationId, status: "reserved" } as const;
};

/** Reserve before native admission. Ambiguous admission keeps its reservation. */
export const reserveEveGuestMessage = async (
  input: GuestReservationInput,
  bootstrap?: GuestBootstrap
) => {
  validateReservation(input, bootstrap);
  return await db.transaction((tx) => reserveMessage(tx, input, bootstrap));
};

type GuestReservationResult = Awaited<ReturnType<typeof reserveMessage>>;
type GuestReservationFailure = Exclude<
  GuestReservationResult,
  { status: "reserved" | "replay" }
>;
class GuestBatchRejectedError extends Error {
  readonly result: GuestReservationFailure;
  constructor(result: GuestReservationFailure) {
    super("Guest batch was not admitted.");
    this.name = "GuestBatchRejectedError";
    this.result = result;
  }
}

/** Comparisons admit every candidate or none, including first-guest account creation. */
export const reserveEveGuestMessages = async <T = undefined>(
  inputs: GuestReservationInput[],
  bootstrap?: GuestBootstrap,
  persistAdmission?: (
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0]
  ) => Promise<T>
) => {
  const [first] = inputs;
  if (!first) {
    throw new Error("Guest admission requires at least one operation.");
  }
  const operations = new Set<string>();
  for (const input of inputs) {
    validateReservation(input, bootstrap);
    if (
      input.ownerId !== first.ownerId ||
      input.ipHash !== first.ipHash ||
      input.requestsPerMinute !== first.requestsPerMinute ||
      input.requestsPerMonth !== first.requestsPerMonth ||
      operations.has(input.operationId.toLowerCase())
    ) {
      throw new Error(
        "Guest batch must use one owner, address and policy with unique operations."
      );
    }
    operations.add(input.operationId.toLowerCase());
  }
  try {
    return await db.transaction(async (tx) => {
      const reservations: {
        operationId: string;
        reservationId: string;
        status: "reserved" | "replay";
      }[] = [];
      for (const input of inputs) {
        // oxlint-disable-next-line eslint/no-await-in-loop -- Keep quota admission and cleanup ordered and bounded.
        const result = await reserveMessage(tx, input, bootstrap);
        if (result.status !== "reserved" && result.status !== "replay") {
          throw new GuestBatchRejectedError(result);
        }
        reservations.push({ operationId: input.operationId, ...result });
      }
      const admission = await persistAdmission?.(tx);
      return { admission, reservations, status: "admitted" } as const;
    });
  } catch (error) {
    if (error instanceof GuestBatchRejectedError) {
      return error.result;
    }
    throw error;
  }
};

export const commitEveGuestMessage = async (
  ownerId: string,
  operationId: string,
  reservationId: string
) => {
  const [row] = await db
    .update(eveGuestMessage)
    .set({ state: "committed" })
    .where(
      and(
        eq(eveGuestMessage.ownerId, ownerId),
        eq(eveGuestMessage.operationId, operationId),
        eq(eveGuestMessage.reservationId, reservationId),
        eq(eveGuestMessage.state, "reserved")
      )
    )
    .returning();
  return !!row;
};

const releaseMessage = async (
  ownerId: string,
  operationId: string,
  reservationId: string,
  requireUncreated: boolean
) =>
  await db.transaction(async (tx) => {
    const identity = and(
      eq(eveGuestMessage.ownerId, ownerId),
      eq(eveGuestMessage.operationId, operationId),
      eq(eveGuestMessage.reservationId, reservationId)
    );
    const [observed] = await tx.select().from(eveGuestMessage).where(identity);
    if (!observed || observed.state !== "reserved") {
      return false;
    }
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`eve-guest-ip:${observed.ipHash}`}))`
    );
    await tx
      .select()
      .from(eveGuest)
      .where(eq(eveGuest.ownerId, ownerId))
      .for("update");
    if (requireUncreated) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${ownerId}`}, 0))`
      );
      const [creation] = await tx
        .select({ id: eveConversation.id })
        .from(eveConversation)
        .where(
          and(
            eq(eveConversation.ownerId, ownerId),
            eq(eveConversation.operationId, operationId)
          )
        );
      if (creation) {
        return false;
      }
    }
    const [released] = await tx
      .update(eveGuestMessage)
      .set({ state: "released" })
      .where(
        and(
          identity,
          eq(eveGuestMessage.state, "reserved"),
          eq(eveGuestMessage.ipHash, observed.ipHash),
          eq(eveGuestMessage.reservedAt, observed.reservedAt)
        )
      )
      .returning();
    if (!released) {
      return false;
    }
    await tx
      .update(eveGuest)
      .set({ remainingMessages: sql`${eveGuest.remainingMessages} + 1` })
      .where(eq(eveGuest.ownerId, ownerId));
    for (const period of windows(released.reservedAt)) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Keep quota admission and cleanup ordered and bounded.
      await tx
        .update(eveGuestRate)
        .set({ requests: sql`${eveGuestRate.requests} - 1` })
        .where(
          and(
            eq(eveGuestRate.ipHash, released.ipHash),
            eq(eveGuestRate.windowSeconds, period.seconds),
            eq(eveGuestRate.startsAt, period.startsAt)
          )
        );
    }
    return true;
  });

/** Only a proven unaccepted request can be refunded; never use this on a timeout. */
export const releaseEveGuestMessage = async (
  ownerId: string,
  operationId: string,
  reservationId: string
) => await releaseMessage(ownerId, operationId, reservationId, false);

/** Serialize proof of no creation with the same family lock used before native dispatch. */
export const releaseEveGuestCreation = async (
  ownerId: string,
  operationId: string,
  reservationId: string
) => await releaseMessage(ownerId, operationId, reservationId, true);

/** Includes expired identities so cleanup and policy never reclassify a guest as a user. */
export const readEveGuestOwner = async (ownerId: string) => {
  const [guest] = await db
    .select({ expiresAt: eveGuest.expiresAt })
    .from(eveGuest)
    .where(eq(eveGuest.ownerId, ownerId));
  return guest;
};
