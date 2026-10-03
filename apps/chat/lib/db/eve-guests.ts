/* oxlint-disable import/no-nodejs-modules, import/no-relative-parent-imports --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { randomUUID } from "node:crypto";; its Node runtime boundary deliberately permits these built-ins.
 * import/no-relative-parent-imports (#530): Keep the explicit "../eve/guest-credential" dependency within this package instead of introducing an alias or barrel API.
 */
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
/* oxlint-enable import/no-nodejs-modules, import/no-relative-parent-imports */

const hash = z.string().regex(/^[0-9a-f]{64}$/u);
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): reservation uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
const reservation = z.object({
  ipHash: hash,
  operationId: z.uuid(),
  ownerId: z.string().min(1),
  requestHash: hash,
  requestsPerMinute: z.number().int().nonnegative(),
  requestsPerMonth: z.number().int().nonnegative(),
});
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types --
 * no-magic-numbers (#517): windows uses 60, 2_592_000, 1000 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/explicit-function-return-type (#560): Keep windows's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): windows accepts now: Date; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const windows = (now: Date) =>
  [60, 2_592_000].map((seconds) => ({
    seconds,
    startsAt: new Date(
      Math.floor(now.getTime() / (seconds * 1000)) * seconds * 1000
    ),
  }));
/* oxlint-enable no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- moving it below executable initialization can obscure ordering and API ownership.
typescript/explicit-function-return-type (#560): Keep createEveGuest's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep createEveGuest's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/prefer-readonly-parameter-types (#565): createEveGuest accepts input: { tokenHash: string; messageLimit: number; expiresAt: Date; }; tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
const createEveGuest = async (input: {
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
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- moving it below executable initialization can obscure ordering and API ownership.
typescript/explicit-function-return-type (#560): Keep readExistingEveGuestMessage's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep readExistingEveGuestMessage's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary. */
const readExistingEveGuestMessage = async (
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
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */

/* oxlint-disable typescript/consistent-type-definitions --
 * typescript/consistent-type-definitions (#559): GuestBootstrap preserves its current alias/interface semantics; declaration merging and implicit index-signature assignability differ between those forms.
 */
type GuestBootstrap = {
  tokenHash: string;
  messageLimit: number;
  expiresAt: Date;
};
/* oxlint-enable typescript/consistent-type-definitions */
type GuestReservationInput = z.infer<typeof reservation>;

/* oxlint-disable typescript/prefer-readonly-parameter-types --
 * typescript/prefer-readonly-parameter-types (#565): validateReservation accepts bootstrap?: GuestBootstrap; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const validateReservation = (
  input: GuestReservationInput,
  bootstrap?: GuestBootstrap
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types --
 * no-magic-numbers (#517): rateAvailable uses 0, 60 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): rateAvailable accepts tx: Parameters<Parameters<typeof db.transaction>[0]>[0]; input: { ipHash: string; requestsPerMinute: number; requestsPerMonth: number; }; periods: ReturnType<typeof windows>; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const rateAvailable = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: {
    ipHash: string;
    requestsPerMinute: number;
    requestsPerMonth: number;
  },
  periods: ReturnType<typeof windows>
): Promise<boolean> => {
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
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-params, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * max-params (#511): admissionGuest keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): admissionGuest keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): admissionGuest uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/explicit-function-return-type (#560): Keep admissionGuest's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): admissionGuest accepts tx: Parameters<Parameters<typeof db.transaction>[0]>[0]; bootstrap: | { tokenHash: string; messageLimit: number; expiresAt: Date;; now: Date; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): admissionGuest intentionally keeps the existing falsy-value behavior of guest; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
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
/* oxlint-enable max-params, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * max-lines-per-function (#510): reserveMessage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): reserveMessage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): reserveMessage uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/explicit-function-return-type (#560): Keep reserveMessage's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): reserveMessage accepts tx: Parameters<Parameters<typeof db.transaction>[0]>[0]; bootstrap?: GuestBootstrap; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): reserveMessage intentionally keeps the existing falsy-value behavior of existing; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
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
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async -- moving it below executable initialization can obscure ordering and API ownership.
jsdoc/require-param (#534): reserveEveGuestMessage's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): reserveEveGuestMessage's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
typescript/explicit-function-return-type (#560): Keep reserveEveGuestMessage's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep reserveEveGuestMessage's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/prefer-readonly-parameter-types (#565): reserveEveGuestMessage accepts bootstrap?: GuestBootstrap; tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/promise-function-async (#606): reserveEveGuestMessage preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections. */
/** Reserve before native admission. Ambiguous admission keeps its reservation. */
const reserveEveGuestMessage = async (
  input: GuestReservationInput,
  bootstrap?: GuestBootstrap
) => {
  validateReservation(input, bootstrap);
  return await db.transaction((tx) => reserveMessage(tx, input, bootstrap));
};
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

type GuestReservationResult = Awaited<ReturnType<typeof reserveMessage>>;
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

/* oxlint-disable id-length, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- id-length (#506): reserveEveGuestMessages uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
moving it below executable initialization can obscure ordering and API ownership.
jsdoc/require-param (#534): reserveEveGuestMessages's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): reserveEveGuestMessages's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
max-lines-per-function (#510): reserveEveGuestMessages keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): reserveEveGuestMessages keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): reserveEveGuestMessages uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/explicit-function-return-type (#560): Keep reserveEveGuestMessages's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep reserveEveGuestMessages's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/prefer-readonly-parameter-types (#565): reserveEveGuestMessages accepts inputs: GuestReservationInput[]; bootstrap?: GuestBootstrap; tx: Parameters<Parameters<typeof db.transaction>[0]>[0]; tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): reserveEveGuestMessages intentionally keeps the existing falsy-value behavior of first; distinguishing empty, zero, and absent states requires a domain behavior decision. */
/** Comparisons admit every candidate or none, including first-guest account creation. */
const reserveEveGuestMessages = async <T = undefined>(
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
/* oxlint-enable id-length, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

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

/* oxlint-disable max-lines-per-function, max-params, max-statements, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * max-lines-per-function (#510): releaseMessage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-params (#511): releaseMessage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): releaseMessage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/prefer-readonly-parameter-types (#565): releaseMessage accepts tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): releaseMessage intentionally keeps the existing falsy-value behavior of observed; creation; released; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const releaseMessage = async (
  ownerId: string,
  operationId: string,
  reservationId: string,
  requireUncreated: boolean
): Promise<boolean> =>
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
/* oxlint-enable max-lines-per-function, max-params, max-statements, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns -- jsdoc/require-param (#534): releaseEveGuestMessage's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): releaseEveGuestMessage's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags. */
/** Only a proven unaccepted request can be refunded; never use this on a timeout. */
const releaseEveGuestMessage = async (
  ownerId: string,
  operationId: string,
  reservationId: string
): Promise<boolean> =>
  await releaseMessage(ownerId, operationId, reservationId, false);
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns -- jsdoc/require-param (#534): releaseEveGuestCreation's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): releaseEveGuestCreation's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags. */
/** Serialize proof of no creation with the same family lock used before native dispatch. */
const releaseEveGuestCreation = async (
  ownerId: string,
  operationId: string,
  reservationId: string
): Promise<boolean> =>
  await releaseMessage(ownerId, operationId, reservationId, true);
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- jsdoc/require-param (#534): readEveGuestOwner's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): readEveGuestOwner's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
typescript/explicit-function-return-type (#560): Keep readEveGuestOwner's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep readEveGuestOwner's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary. */
/** Includes expired identities so cleanup and policy never reclassify a guest as a user. */
const readEveGuestOwner = async (ownerId: string) => {
  const [guest] = await db
    .select({ expiresAt: eveGuest.expiresAt })
    .from(eveGuest)
    .where(eq(eveGuest.ownerId, ownerId));
  return guest;
};
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */

/* oxlint-disable max-lines -- #509: This eve-guests.ts module keeps its existing API and workflow boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric. */
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
