/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { randomUUID } from "node:crypto";; its Node runtime boundary deliberately permits these built-ins.
 */
import { randomUUID } from "node:crypto";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { and, eq, sql } from "drizzle-orm";
/* oxlint-enable sort-imports */
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { eveGuestOwnerId } from "@/lib/eve/guest-credential";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
/* oxlint-enable sort-imports */

import { db } from "./client";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  eveConversation,
  eveGuest,
  eveGuestMessage,
  eveGuestRate,
  user,
} from "./schema";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-nodejs-modules */

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

type GuestWriteTransaction = GuestTransaction;

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

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve createEveGuest's awaited sequencing and rejected-Promise behavior. */

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
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- This original transaction performs .insert operations under caller-held locks; preserve the native writer contract.
  return await db.transaction(async (tx: GuestWriteTransaction) => {
    const ownerId = eveGuestOwnerId(input.tokenHash);
    await tx.insert(user).values({
      email: `${ownerId}@guest.invalid`,
      id: ownerId,
      name: "Guest",
    });
    const [guest] = await tx
      .insert(eveGuest)
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing input own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      .values({ ...input, ownerId, remainingMessages: input.messageLimit })
      .returning();
    return guest;
  });
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve readExistingEveGuestMessage's awaited sequencing and rejected-Promise behavior. */

const readExistingEveGuestMessage = async (
  ownerId: string,
  operationId: string
): Promise<
  Pick<
    typeof eveGuestMessage.$inferSelect,
    "requestHash" | "reservationId" | "state"
  >
> => {
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
/* oxlint-enable oxc/no-async-await */
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

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve rateAvailable's awaited sequencing and rejected-Promise behavior. */

const rateAvailable = async (
  tx: Readonly<Pick<GuestTransaction, "select">>,
  input: ReadonlyNativeSurface<{
    ipHash: string;
    requestsPerMinute: number;
    requestsPerMonth: number;
  }>,
  periods: GuestRatePeriods
): Promise<boolean> => {
  for (const period of periods) {
    const limit =
      // oxlint-disable-next-line no-ternary -- Keep limit as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      period.seconds === MINUTE_WINDOW_SECONDS
        ? input.requestsPerMinute
        : input.requestsPerMonth;
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
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading requests from bucket; preserve one receiver evaluation, skipped accesses and the existing EMPTY_QUOTA fallback. The app guidance prefers optional chaining.
    if ((bucket?.requests ?? EMPTY_QUOTA) >= limit) {
      return false;
    }
  }
  return true;
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve admissionGuest's awaited sequencing and rejected-Promise behavior. */

/* oxlint-disable max-params, max-statements, typescript/strict-boolean-expressions --
 * max-params (#511): admissionGuest keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): admissionGuest keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/strict-boolean-expressions (#610): admissionGuest intentionally keeps the existing falsy-value behavior of guest; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const admissionGuest = async (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- This original transaction performs .insert operations under caller-held locks; preserve the native writer contract.
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
  if (!guest && bootstrap) {
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
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing bootstrap own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve reserveMessage's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-params, max-statements, typescript/strict-boolean-expressions */

/* oxlint-disable max-lines-per-function, max-statements, typescript/strict-boolean-expressions --
 * max-lines-per-function (#510): reserveMessage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): reserveMessage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/strict-boolean-expressions (#610): reserveMessage intentionally keeps the existing falsy-value behavior of existing; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const reserveMessage = async (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- This original transaction performs .execute, .insert, .update operations under caller-held locks; preserve the native writer contract.
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
  if (existing && existing.requestHash !== input.requestHash) {
    return { status: "conflict" } as const;
  }
  if (existing && existing.state !== "released") {
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
  for (const period of periods) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Keep quota admission and cleanup ordered and bounded.
    await tx
      .insert(eveGuestRate)
      .values({
        ipHash: input.ipHash,
        requests: SINGLE_REQUEST,
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve reserveEveGuestMessage's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-statements, typescript/strict-boolean-expressions */

/* oxlint-disable typescript/promise-function-async -- Preserve the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections. */
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
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Forward the original live transaction into reservation/admission helpers that persist rows and locks; the native helper receiver rejects a readonly projection (TS2345).
  return await db.transaction((tx: GuestWriteTransaction) =>
    reserveMessage(tx, input, bootstrap)
  );
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/promise-function-async */

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

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve reserveEveGuestMessages's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable id-length, max-statements -- id-length (#506): reserveEveGuestMessages uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
max-statements (#512): reserveEveGuestMessages keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
*/
/**
 * Comparisons admit every candidate or none, including first-guest account creation.
 * @param {readonly ReadonlyNativeSurface<GuestReservationInput>[]} inputs Candidate operations sharing one owner, address and quota policy.
 * @param {ReadonlyNativeSurface<GuestBootstrap> | undefined} bootstrap Optional first-guest identity admitted atomically with all candidates.
 * @param {((tx: GuestWriteTransaction) => Promise<T>) | undefined} persistAdmission Optional transaction callback storing comparison intent after every reservation succeeds.
 * @returns {Promise<GuestBatchResult<T>>} All reservations and the callback result on atomic admission, or the rejecting candidate status after rollback.
 */
const reserveEveGuestMessages = async <T = undefined>(
  inputs: readonly ReadonlyNativeSurface<GuestReservationInput>[],
  bootstrap?: ReadonlyNativeSurface<GuestBootstrap>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The admission callback receives the original live transaction to persist comparison intent; retain its native writer contract.
  persistAdmission?: (tx: GuestWriteTransaction) => Promise<T>
): Promise<GuestBatchResult<T>> => {
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
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Forward the original live transaction into reservation/admission helpers that persist rows and locks; the native helper receiver rejects a readonly projection (TS2345).
    return await db.transaction(async (tx: GuestWriteTransaction) => {
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
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing result own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        reservations.push({ operationId: input.operationId, ...result });
      }
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling persistAdmission; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve commitEveGuestMessage's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable id-length, max-statements */

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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve releaseMessage's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-lines-per-function, max-params, max-statements, typescript/strict-boolean-expressions --
 * max-lines-per-function (#510): releaseMessage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-params (#511): releaseMessage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): releaseMessage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/strict-boolean-expressions (#610): releaseMessage intentionally keeps the existing falsy-value behavior of observed; creation; released; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const releaseMessage = async (
  ownerId: string,
  operationId: string,
  reservationId: string,
  requireUncreated: boolean
): Promise<boolean> =>
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- This original transaction performs .execute, .update operations under caller-held locks; preserve the native writer contract.
  await db.transaction(async (tx: GuestWriteTransaction) => {
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve releaseEveGuestMessage's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-params, max-statements, typescript/strict-boolean-expressions */

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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve releaseEveGuestCreation's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve readEveGuestOwner's awaited sequencing and rejected-Promise behavior. */
/**
 * Includes expired identities so cleanup and policy never reclassify a guest as a user.
 * @param {string} ownerId Durable guest owner identity inspected by cleanup or policy.
 * @returns {Promise<Pick<typeof eveGuest.$inferSelect, "expiresAt">>} The stored expiry, including expired identities, from the existing row lookup.
 */
const readEveGuestOwner = async (
  ownerId: string
): Promise<Pick<typeof eveGuest.$inferSelect, "expiresAt">> => {
  const [guest] = await db
    .select({ expiresAt: eveGuest.expiresAt })
    .from(eveGuest)
    .where(eq(eveGuest.ownerId, ownerId));
  return guest;
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (commitEveGuestMessage, createEveGuest, readEveGuestOwner, readExistingEveGuestMessage, releaseEveGuestCreation, releaseEveGuestMessage, reserveEveGuestMessage, reserveEveGuestMessages); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable max-lines -- #509: This eve-guests.ts module keeps its existing API and workflow boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric.
 */
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
/* oxlint-enable import/no-named-export */
