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

const hash = z.string().regex(/^[0-9a-f]{64}$/);
const reservation = z.object({
  ownerId: z.string().min(1),
  operationId: z.uuid(),
  requestHash: hash,
  ipHash: hash,
  requestsPerMinute: z.number().int().nonnegative(),
  requestsPerMonth: z.number().int().nonnegative(),
});

function windows(now: Date) {
  return [60, 2_592_000].map((seconds) => ({
    seconds,
    startsAt: new Date(
      Math.floor(now.getTime() / (seconds * 1000)) * seconds * 1000
    ),
  }));
}

export async function createEveGuest(input: {
  tokenHash: string;
  messageLimit: number;
  expiresAt: Date;
}) {
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
      id: ownerId,
      name: "Guest",
      email: `${ownerId}@guest.invalid`,
    });
    const [guest] = await tx
      .insert(eveGuest)
      .values({ ...input, ownerId, remainingMessages: input.messageLimit })
      .returning();
    return guest;
  });
}

/** An expired credential must never be mistaken for a not-yet-admitted guest. */
export async function readEveGuestCredential(tokenHash: string) {
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
  return { status: "active", guest } as const;
}

export async function readExistingEveGuestMessage(
  ownerId: string,
  operationId: string
) {
  const [message] = await db
    .select({
      state: eveGuestMessage.state,
      requestHash: eveGuestMessage.requestHash,
      reservationId: eveGuestMessage.reservationId,
    })
    .from(eveGuestMessage)
    .where(
      and(
        eq(eveGuestMessage.ownerId, ownerId),
        eq(eveGuestMessage.operationId, operationId)
      )
    );
  return message;
}

type GuestBootstrap = {
  tokenHash: string;
  messageLimit: number;
  expiresAt: Date;
};
type GuestReservationInput = z.infer<typeof reservation>;

function validateReservation(
  input: GuestReservationInput,
  bootstrap?: GuestBootstrap
) {
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
}

/** Reserve before native admission. Ambiguous admission keeps its reservation. */
export async function reserveEveGuestMessage(
  input: GuestReservationInput,
  bootstrap?: GuestBootstrap
) {
  validateReservation(input, bootstrap);
  return await db.transaction((tx) => reserveMessage(tx, input, bootstrap));
}

type GuestReservationResult = Awaited<ReturnType<typeof reserveMessage>>;
type GuestReservationFailure = Exclude<
  GuestReservationResult,
  { status: "reserved" | "replay" }
>;
class GuestBatchRejected extends Error {
  readonly result: GuestReservationFailure;
  constructor(result: GuestReservationFailure) {
    super("Guest batch was not admitted.");
    this.result = result;
  }
}

/** Comparisons admit every candidate or none, including first-guest account creation. */
export async function reserveEveGuestMessages<T = undefined>(
  inputs: GuestReservationInput[],
  bootstrap?: GuestBootstrap,
  persistAdmission?: (
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0]
  ) => Promise<T>
) {
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
      const reservations: Array<{
        operationId: string;
        reservationId: string;
        status: "reserved" | "replay";
      }> = [];
      for (const input of inputs) {
        const result = await reserveMessage(tx, input, bootstrap);
        if (result.status !== "reserved" && result.status !== "replay") {
          throw new GuestBatchRejected(result);
        }
        reservations.push({ operationId: input.operationId, ...result });
      }
      const admission = await persistAdmission?.(tx);
      return { status: "admitted", reservations, admission } as const;
    });
  } catch (error) {
    if (error instanceof GuestBatchRejected) {
      return error.result;
    }
    throw error;
  }
}

async function reserveMessage(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: GuestReservationInput,
  bootstrap?: GuestBootstrap
) {
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
      status: "replay",
      reservationId: existing.reservationId,
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
    await tx
      .insert(eveGuestRate)
      .values({
        ipHash: input.ipHash,
        windowSeconds: period.seconds,
        startsAt: period.startsAt,
        requests: 1,
      })
      .onConflictDoUpdate({
        target: [
          eveGuestRate.ipHash,
          eveGuestRate.windowSeconds,
          eveGuestRate.startsAt,
        ],
        set: { requests: sql`${eveGuestRate.requests} + 1` },
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
      ownerId: input.ownerId,
      operationId: input.operationId,
      requestHash: input.requestHash,
      reservationId,
      ipHash: input.ipHash,
      state: "reserved",
      reservedAt: now,
    })
    .onConflictDoUpdate({
      target: [eveGuestMessage.ownerId, eveGuestMessage.operationId],
      set: {
        state: "reserved",
        reservationId,
        ipHash: input.ipHash,
        reservedAt: now,
      },
    });
  return { status: "reserved", reservationId } as const;
}

export async function commitEveGuestMessage(
  ownerId: string,
  operationId: string,
  reservationId: string
) {
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
}

/** Only a proven unaccepted request can be refunded; never use this on a timeout. */
export async function releaseEveGuestMessage(
  ownerId: string,
  operationId: string,
  reservationId: string
) {
  return await releaseMessage(ownerId, operationId, reservationId, false);
}

/** Serialize proof of no creation with the same family lock used before native dispatch. */
export async function releaseEveGuestCreation(
  ownerId: string,
  operationId: string,
  reservationId: string
) {
  return await releaseMessage(ownerId, operationId, reservationId, true);
}

async function releaseMessage(
  ownerId: string,
  operationId: string,
  reservationId: string,
  requireUncreated: boolean
) {
  return await db.transaction(async (tx) => {
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
}

async function rateAvailable(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: {
    ipHash: string;
    requestsPerMinute: number;
    requestsPerMonth: number;
  },
  periods: ReturnType<typeof windows>
) {
  for (const period of periods) {
    const limit =
      period.seconds === 60 ? input.requestsPerMinute : input.requestsPerMonth;
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
}

async function admissionGuest(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: z.infer<typeof reservation>,
  bootstrap:
    | { tokenHash: string; messageLimit: number; expiresAt: Date }
    | undefined,
  now: Date
) {
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
      id: input.ownerId,
      name: "Guest",
      email: `${input.ownerId}@guest.invalid`,
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
  return { status: "ready", guest } as const;
}

/** Includes expired identities so cleanup and policy never reclassify a guest as a user. */
export async function readEveGuestOwner(ownerId: string) {
  const [guest] = await db
    .select({ expiresAt: eveGuest.expiresAt })
    .from(eveGuest)
    .where(eq(eveGuest.ownerId, ownerId));
  return guest;
}
