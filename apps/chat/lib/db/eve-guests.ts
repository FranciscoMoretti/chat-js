import { and, eq, or, sql } from "drizzle-orm";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { eveGuestOwnerId } from "@/lib/eve/guest-credential";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { db } from "./client";
import {
  eveConversation,
  eveGuest,
  eveGuestMessage,
  eveGuestRate,
  user,
} from "./schema";

const hasQueryRow: (row: unknown) => boolean = Boolean;

const MIN_OWNER_ID_LENGTH = 1;
const MINUTE_WINDOW_SECONDS = 60;
const MONTH_WINDOW_SECONDS = 2_592_000;
const MILLISECONDS_PER_SECOND = 1000;
const EMPTY_QUOTA = 0;
const SINGLE_REQUEST = 1;
const FIRST_PARAMETER_INDEX = 0;

type GuestTransaction = Parameters<
  Parameters<typeof db.transaction>[typeof FIRST_PARAMETER_INDEX]
>[typeof FIRST_PARAMETER_INDEX];

type GuestWriteTransaction = Readonly<
  Pick<GuestTransaction, "select" | "execute" | "insert" | "update">
>;

interface GuestRateWindow {
  seconds: number;
  startsAt: Date;
}
type GuestRatePeriods = ReadonlyNativeSurface<ReturnType<typeof windows>>;
type GuestAdmissionStatus = "unavailable" | "exhausted" | "rate-limited";
type GuestAdmissionFailure = {
  [Status in GuestAdmissionStatus]: Readonly<{
    status: Status;
    guest?: undefined;
  }>;
}[GuestAdmissionStatus];
type GuestAdmissionResult =
  | GuestAdmissionFailure
  | Readonly<{ guest: typeof eveGuest.$inferSelect; status: "ready" }>;
type GuestReservationResult =
  | GuestAdmissionFailure
  | Readonly<{ status: "conflict"; reservationId?: undefined }>
  | Readonly<{ reservationId: string; status: "replay" }>
  | Readonly<{
      reservationId: ReturnType<typeof randomUUID>;
      status: "reserved";
    }>;
type GuestBatchResult<Result> =
  | GuestReservationFailure
  | Readonly<{
      admission: Awaited<Result> | undefined;
      reservations: {
        operationId: string;
        reservationId: string;
        status: "reserved" | "replay";
      }[];
      status: "admitted";
    }>;

const hash = z.string().regex(/^[0-9a-f]{64}$/u);

const reservation = z.object({
  ipHash: hash,
  operationId: z.uuid(),
  ownerId: z.string().min(MIN_OWNER_ID_LENGTH),
  requestHash: hash,
  requestsPerMinute: z.number().int().nonnegative(),
  requestsPerMonth: z.number().int().nonnegative(),
});

const windows = (now: ReadonlyNativeSurface<Date>): GuestRateWindow[] =>
  [MINUTE_WINDOW_SECONDS, MONTH_WINDOW_SECONDS].map((seconds) => ({
    seconds,
    startsAt: new Date(
      Math.floor(now.getTime() / (seconds * MILLISECONDS_PER_SECOND)) *
        seconds *
        MILLISECONDS_PER_SECOND
    ),
  }));

const createEveGuest = async (
  input: ReadonlyNativeSurface<{
    tokenHash: string;
    messageLimit: number;
    expiresAt: Date;
  }>
): Promise<typeof eveGuest.$inferSelect> => {
  hash.parse(input.tokenHash);
  z.number().int().nonnegative().parse(input.messageLimit);
  if (
    !Number.isFinite(input.expiresAt.getTime()) ||
    input.expiresAt <= new Date()
  ) {
    throw new Error("Guest expiry must be in the future.");
  }
  return await db.transaction(async (tx: GuestWriteTransaction) => {
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

const readExistingEveGuestMessage = async (
  ownerId: string,
  operationId: string
): Promise<Pick<
  typeof eveGuestMessage.$inferSelect,
  "requestHash" | "reservationId" | "state"
> | null> => {
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
  return message ?? null;
};
interface GuestBootstrap {
  tokenHash: string;
  messageLimit: number;
  expiresAt: Date;
}
type GuestReservationInput = z.infer<typeof reservation>;

const validateReservation = (
  input: GuestReservationInput,
  bootstrap?: ReadonlyNativeSurface<GuestBootstrap>
): void => {
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
  tx: Readonly<Pick<GuestTransaction, "select">>,
  input: ReadonlyNativeSurface<{
    ipHash: string;
    requestsPerMinute: number;
    requestsPerMonth: number;
  }>,
  periods: GuestRatePeriods
): Promise<boolean> => {
  const buckets = await tx
    .select()
    .from(eveGuestRate)
    .where(
      and(
        eq(eveGuestRate.ipHash, input.ipHash),
        or(
          ...periods.map((period) =>
            and(
              eq(eveGuestRate.windowSeconds, period.seconds),
              eq(eveGuestRate.startsAt, period.startsAt)
            )
          )
        )
      )
    );
  return periods.every((period) => {
    const limit =
      period.seconds === MINUTE_WINDOW_SECONDS
        ? input.requestsPerMinute
        : input.requestsPerMonth;
    const bucket = buckets.find(
      (row) =>
        row.windowSeconds === period.seconds &&
        row.startsAt.getTime() === period.startsAt.getTime()
    );
    return (bucket?.requests ?? EMPTY_QUOTA) < limit;
  });
};

const admissionGuest = async (
  tx: GuestWriteTransaction,
  input: ReadonlyNativeSurface<GuestReservationInput>,
  bootstrap:
    | ReadonlyNativeSurface<{
        tokenHash: string;
        messageLimit: number;
        expiresAt: Date;
      }>
    | undefined,
  now: ReadonlyNativeSurface<Date>
): Promise<GuestAdmissionResult> => {
  let [guest] = await tx
    .select()
    .from(eveGuest)
    .where(eq(eveGuest.ownerId, input.ownerId))
    .for("update");
  if (!hasQueryRow(guest) && bootstrap) {
    if (bootstrap.expiresAt <= now) {
      return { status: "unavailable" } as const;
    }
    if (bootstrap.messageLimit === EMPTY_QUOTA) {
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
  if (!hasQueryRow(guest) || guest.expiresAt <= now) {
    return { status: "unavailable" } as const;
  }
  return { guest, status: "ready" } as const;
};

const reserveMessage = async (
  tx: GuestWriteTransaction,
  input: ReadonlyNativeSurface<GuestReservationInput>,
  bootstrap?: ReadonlyNativeSurface<GuestBootstrap>
): Promise<GuestReservationResult> => {
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
  if (hasQueryRow(existing) && existing.requestHash !== input.requestHash) {
    return { status: "conflict" } as const;
  }
  if (hasQueryRow(existing) && existing.state !== "released") {
    return {
      reservationId: existing.reservationId,
      status: "replay",
    } as const;
  }
  if (guest.remainingMessages === EMPTY_QUOTA) {
    return { status: "exhausted" } as const;
  }
  const periods = windows(now);
  if (!(await rateAvailable(tx, input, periods))) {
    return { status: "rate-limited" } as const;
  }
  await tx
    .insert(eveGuestRate)
    .values(
      periods.map((period) => ({
        ipHash: input.ipHash,
        requests: SINGLE_REQUEST,
        startsAt: period.startsAt,
        windowSeconds: period.seconds,
      }))
    )
    .onConflictDoUpdate({
      set: { requests: sql`${eveGuestRate.requests} + 1` },
      target: [
        eveGuestRate.ipHash,
        eveGuestRate.windowSeconds,
        eveGuestRate.startsAt,
      ],
    });
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

/**
 * Reserve before native admission. Ambiguous admission keeps its reservation.
 * @param {GuestReservationInput} input Validated owner, operation, request digest and address quota policy to reserve.
 * @param {GuestBootstrap | undefined} bootstrap Optional first-guest identity and expiry, created only when admission succeeds.
 * @returns {Promise<GuestReservationResult>} The new or replayed reservation, or the exact identity/quota admission rejection.
 */
const reserveEveGuestMessage = async (
  input: ReadonlyNativeSurface<GuestReservationInput>,
  bootstrap?: ReadonlyNativeSurface<GuestBootstrap>
): Promise<GuestReservationResult> => {
  validateReservation(input, bootstrap);
  return await db.transaction(
    async (tx: GuestWriteTransaction) =>
      await reserveMessage(tx, input, bootstrap)
  );
};

type GuestReservationFailure = Exclude<
  GuestReservationResult,
  { status: "reserved" | "replay" }
>;
class GuestBatchRejectedError extends Error {
  public readonly result: GuestReservationFailure;
  public constructor(result: GuestReservationFailure) {
    super("Guest batch was not admitted.");
    this.name = "GuestBatchRejectedError";
    this.result = result;
  }
}

/**
 * Comparisons admit every candidate or none, including first-guest account creation.
 * @param {readonly ReadonlyNativeSurface<GuestReservationInput>[]} inputs Candidate operations sharing one owner, address and quota policy.
 * @param {ReadonlyNativeSurface<GuestBootstrap> | undefined} bootstrap Optional first-guest identity admitted atomically with all candidates.
 * @param {((tx: GuestTransaction) => Promise<Admission>) | undefined} persistAdmission Optional transaction callback storing comparison intent after every reservation succeeds.
 * @returns {Promise<GuestBatchResult<T>>} All reservations and the callback result on atomic admission, or the rejecting candidate status after rollback.
 */
const reserveEveGuestMessages = async <Admission = undefined>(
  inputs: readonly ReadonlyNativeSurface<GuestReservationInput>[],
  bootstrap?: ReadonlyNativeSurface<GuestBootstrap>,
  persistAdmission?: (tx: GuestTransaction) => Promise<Admission>
): Promise<GuestBatchResult<Admission>> => {
  const [first] = inputs;
  if (typeof first !== "object" || first === null) {
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
    return await db.transaction(async (tx: GuestTransaction) => {
      const reservations: {
        operationId: string;
        reservationId: string;
        status: "reserved" | "replay";
      }[] = [];
      for (const input of inputs) {
        // oxlint-disable-next-line eslint/no-await-in-loop -- Each candidate consumes the shared guest balance and IP windows in this transaction; stop at the first rejection before reserving another candidate.
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

const commitEveGuestMessage = async (
  ownerId: string,
  operationId: string,
  reservationId: string
): Promise<boolean> => {
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
  return Boolean(row);
};
const releaseMessage = async (
  ownerId: string,
  operationId: string,
  reservationId: string,
  requireUncreated: boolean
): Promise<boolean> =>
  await db.transaction(async (tx: GuestWriteTransaction) => {
    const identity = and(
      eq(eveGuestMessage.ownerId, ownerId),
      eq(eveGuestMessage.operationId, operationId),
      eq(eveGuestMessage.reservationId, reservationId)
    );
    const [observed] = await tx.select().from(eveGuestMessage).where(identity);
    if (!hasQueryRow(observed) || observed.state !== "reserved") {
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
      if (hasQueryRow(creation)) {
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
    if (!hasQueryRow(released)) {
      return false;
    }
    await tx
      .update(eveGuest)
      .set({ remainingMessages: sql`${eveGuest.remainingMessages} + 1` })
      .where(eq(eveGuest.ownerId, ownerId));
    await tx
      .update(eveGuestRate)
      .set({ requests: sql`${eveGuestRate.requests} - 1` })
      .where(
        and(
          eq(eveGuestRate.ipHash, released.ipHash),
          or(
            ...windows(released.reservedAt).map((period) =>
              and(
                eq(eveGuestRate.windowSeconds, period.seconds),
                eq(eveGuestRate.startsAt, period.startsAt)
              )
            )
          )
        )
      );
    return true;
  });

/**
 * Only a proven unaccepted request can be refunded; never use this on a timeout.
 * @param {string} ownerId Owner whose exact reservation can be refunded.
 * @param {string} operationId Operation proved unaccepted by native admission.
 * @param {string} reservationId Exact reservation receipt to fence stale refunds.
 * @returns {Promise<boolean>} Whether the matching reserved message was released and its quota refunded.
 */
const releaseEveGuestMessage = async (
  ownerId: string,
  operationId: string,
  reservationId: string
): Promise<boolean> =>
  await releaseMessage(ownerId, operationId, reservationId, false);
/**
 * Serialize proof of no creation with the same family lock used before native dispatch.
 * @param {string} ownerId Owner whose guest and conversation family locks fence the refund.
 * @param {string} operationId Operation whose conversation creation must still be absent.
 * @param {string} reservationId Exact reservation receipt to fence stale refunds.
 * @returns {Promise<boolean>} Whether no creation existed and the matching reservation was atomically released.
 */
const releaseEveGuestCreation = async (
  ownerId: string,
  operationId: string,
  reservationId: string
): Promise<boolean> =>
  await releaseMessage(ownerId, operationId, reservationId, true);
/**
 * Includes expired identities so cleanup and policy never reclassify a guest as a user.
 * @param {string} ownerId Durable guest owner identity inspected by cleanup or policy.
 * @returns {Promise<Pick<typeof eveGuest.$inferSelect, "expiresAt"> | null>} The stored expiry, including expired identities, or null when no guest identity exists.
 */
const readEveGuestOwner = async (
  ownerId: string
): Promise<Pick<typeof eveGuest.$inferSelect, "expiresAt"> | null> => {
  const [guest] = await db
    .select({ expiresAt: eveGuest.expiresAt })
    .from(eveGuest)
    .where(eq(eveGuest.ownerId, ownerId));
  return guest ?? null;
};
export {
  commitEveGuestMessage,
  createEveGuest,
  readEveGuestOwner,
  readExistingEveGuestMessage,
  releaseEveGuestCreation,
  releaseEveGuestMessage,
  reserveEveGuestMessage,
  reserveEveGuestMessages,
};
