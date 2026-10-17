import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { EveUsageReconciliationBusyError } from "@/lib/eve/usage-reconciliation-busy";
import { databaseConnection } from "./connection";
import { db } from "./client";
import { drizzle } from "drizzle-orm/postgres-js";
import { env } from "@/lib/env";
import postgres from "postgres";
import { z } from "zod";
import { isDeepStrictEqual } from "node:util";

import {
  eveConversation,
  eveGuest,
  eveUsage,
  user,
  userCredit,
} from "./schema";

const ZERO_CENTS = 0;
const MINIMUM_COST_USD = 0;
const COST_DECIMAL_PLACES = 12;
const MINIMUM_USAGE_STREAM_INDEX = 0;
const SINGLE_USAGE_MATCH_LIMIT = 1;

type UsageTransaction = Readonly<
  Pick<typeof db, "select" | "insert" | "update">
>;

const hasConflictingCost = (
  stored: string | null,
  incoming: string | null
): boolean =>
  stored !== null && incoming !== null && Number(stored) !== Number(incoming);

const modelEvidence = z
  .object({
    eventId: z.string(),
    ownerId: z.string(),
    sessionId: z.string(),
    turnId: z.string().optional(),
    modelId: z.string(),
    provider: z.string(),
    state: z.enum(["pending", "returned"]),
  })
  .loose();

const evidenceFields = z.record(z.string(), z.unknown());
const mergeEvidenceFields = (stored: unknown, incoming: unknown): unknown => {
  if (stored === undefined) {
    return incoming;
  }
  if (incoming === undefined || isDeepStrictEqual(stored, incoming)) {
    return stored;
  }
  const previous = evidenceFields.safeParse(stored);
  const next = evidenceFields.safeParse(incoming);
  if (!(previous.success && next.success)) {
    throw new Error("Model receipt evidence conflict.");
  }
  return {
    ...previous.data,
    ...Object.fromEntries(
      Object.entries(next.data).map(([key, value]) => [
        key,
        mergeEvidenceFields(previous.data[key], value),
      ])
    ),
  };
};

const mergeModelEvidence = (stored: unknown, incoming: unknown): unknown => {
  if (stored === null || stored === undefined) {
    return incoming;
  }
  if (incoming === undefined) {
    return stored;
  }
  const previous = modelEvidence.safeParse(stored);
  // Compare against the same JSON representation persisted by the database (Dates included).
  // oxlint-disable-next-line unicorn/prefer-structured-clone -- JSON serialization must match jsonb; structuredClone preserves Dates instead.
  const next = modelEvidence.safeParse(JSON.parse(JSON.stringify(incoming)));
  if (!previous.success || !next.success) {
    if (!isDeepStrictEqual(stored, incoming)) {
      throw new Error("Model evidence identity conflict.");
    }
    return stored;
  }
  const { state: previousState, ...previousFields } = previous.data;
  const { state: nextState, ...nextFields } = next.data;
  for (const key of [
    "eventId",
    "ownerId",
    "sessionId",
    "turnId",
    "modelId",
    "provider",
  ]) {
    if (previousFields[key] !== nextFields[key]) {
      throw new Error("Model evidence identity conflict.");
    }
  }
  if (previousState === "returned" && nextState === "pending") {
    return stored;
  }
  return {
    ...evidenceFields.parse(mergeEvidenceFields(previousFields, nextFields)),
    state: nextState,
  };
};

const debitTurnUsage = async (
  tx: UsageTransaction,
  input: {
    readonly ownerId: string;
    readonly sessionId: string;
    readonly turnId: string;
    readonly eventId: string;
  }
): Promise<void> => {
  // Sum in Postgres decimal arithmetic; round once per turn, not once per model step.
  const [totals] = await tx
    .select({
      due: sql<number>`ceil(coalesce(sum(${eveUsage.costUsd}), 0) * 100)::integer`,
      paid: sql<number>`coalesce(sum(${eveUsage.chargedCents}), 0)::integer`,
    })
    .from(eveUsage)
    .where(
      and(
        eq(eveUsage.sessionId, input.sessionId),
        eq(eveUsage.turnId, input.turnId),
        eq(eveUsage.ownerId, input.ownerId)
      )
    );
  const delta = (totals?.due ?? ZERO_CENTS) - (totals?.paid ?? ZERO_CENTS);
  if (delta > ZERO_CENTS) {
    await tx
      .update(userCredit)
      .set({ credits: sql`${userCredit.credits} - ${delta}` })
      .where(eq(userCredit.userId, input.ownerId));
    await tx
      .update(eveUsage)
      .set({ chargedCents: sql`${eveUsage.chargedCents} + ${delta}` })
      .where(eq(eveUsage.eventId, input.eventId));
  }
};

/**
 * A replay can arrive concurrently with the hook. Both use the same durable event ID.
 * @param {{ eventId: string; sessionId: string; turnId: string; ownerId: string; costUsd?: number; generationId?: string; }} input Native usage event identity and optional provider cost evidence.
 * @param {string} input.eventId Durable event identity used to deduplicate concurrent hook and replay ingestion.
 * @param {string} input.sessionId Native session whose turn cost is recorded.
 * @param {string} input.turnId Native turn whose decimal costs are rounded and charged together.
 * @param {string} input.ownerId Owner whose credit or guest quota identity scopes the record.
 * @param {number | undefined} input.costUsd Optional nonnegative provider cost, preserved as decimal evidence.
 * @param {string | undefined} input.generationId Optional provider generation identifier used for later reconciliation.
 * @returns {Promise<boolean>} Whether priced evidence is durably available after idempotent ingestion and any registered-user debit.
 */
const recordEveUsage = async (input: {
  readonly eventId: string;
  readonly sessionId: string;
  readonly turnId: string;
  readonly ownerId: string;
  readonly costUsd?: number;
  readonly generationId?: string;
  readonly modelAttempt?: unknown;
}): Promise<boolean> => {
  if (
    !input.eventId ||
    (input.costUsd !== undefined &&
      (!Number.isFinite(input.costUsd) || input.costUsd < MINIMUM_COST_USD))
  ) {
    throw new Error("Invalid Eve usage evidence.");
  }
  // A known cost and its debit commit together. Replaying that same evidence
  // needs no credit-row lock or another turn-total calculation.
  const [settled] = await db
    .select()
    .from(eveUsage)
    .where(
      and(
        eq(eveUsage.eventId, input.eventId),
        eq(eveUsage.ownerId, input.ownerId),
        eq(eveUsage.sessionId, input.sessionId),
        eq(eveUsage.turnId, input.turnId),
        isNotNull(eveUsage.costUsd)
      )
    );
  const hasSettledUsage = Boolean(settled);
  if (
    hasSettledUsage &&
    input.modelAttempt === undefined &&
    input.generationId === undefined
  ) {
    const incoming =
      input.costUsd === undefined
        ? null
        : input.costUsd.toFixed(COST_DECIMAL_PLACES);
    if (hasConflictingCost(settled.costUsd, incoming)) {
      throw new Error("Eve usage amount changed; reconcile provider evidence.");
    }
    return true;
  }
  return await db.transaction(async (tx: UsageTransaction) => {
    const [guest] = await tx
      .select({ ownerId: eveGuest.ownerId })
      .from(eveGuest)
      .where(eq(eveGuest.ownerId, input.ownerId))
      .for("update");
    const isGuest = Boolean(guest);
    if (!isGuest) {
      await tx
        .insert(userCredit)
        .values({ userId: input.ownerId })
        .onConflictDoNothing();
      await tx
        .select()
        .from(userCredit)
        .where(eq(userCredit.userId, input.ownerId))
        .for("update");
    }
    const costUsd =
      input.costUsd === undefined
        ? null
        : input.costUsd.toFixed(COST_DECIMAL_PLACES);
    const [existing] = await tx
      .select()
      .from(eveUsage)
      .where(eq(eveUsage.eventId, input.eventId));
    const hasExistingUsage = Boolean(existing);
    if (hasExistingUsage) {
      if (
        existing.ownerId !== input.ownerId ||
        existing.sessionId !== input.sessionId ||
        existing.turnId !== input.turnId
      ) {
        throw new Error("Eve usage identity conflict.");
      }
      if (hasConflictingCost(existing.costUsd, costUsd)) {
        throw new Error(
          "Eve usage amount changed; reconcile provider evidence."
        );
      }
      if (
        existing.generationId !== null &&
        input.generationId !== undefined &&
        existing.generationId !== input.generationId
      ) {
        throw new Error("Eve usage generation identity conflict.");
      }
      await tx
        .update(eveUsage)
        .set({
          costUsd: existing.costUsd ?? costUsd,
          generationId: input.generationId ?? existing.generationId,
          modelAttempt: mergeModelEvidence(
            existing.modelAttempt,
            input.modelAttempt
          ),
        })
        .where(eq(eveUsage.eventId, input.eventId));
    } else {
      await tx.insert(eveUsage).values({ ...input, costUsd });
    }
    // Guest admission spends message quota. Keep provider costs without granting
    // signup credit or mixing monetary debits into that separate allowance.
    if (!isGuest) {
      await debitTurnUsage(tx, input);
    }
    const recordedCost = costUsd ?? existing?.costUsd;
    return recordedCost !== null && recordedCost !== undefined;
  });
};

/**
 * This cursor is billing progress, never a second copy of the transcript.
 * @param {string} ownerId Owner whose bound session is authorized.
 * @param {string} sessionId Native session whose durable billing cursor is read.
 * @returns {Promise<number>} The current ingestion stream index; missing owned bindings throw.
 */
const getEveUsageCursor = async (
  ownerId: string,
  sessionId: string
): Promise<number> => {
  const rows = await db
    .select({ streamIndex: eveConversation.usageStreamIndex })
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.ownerId, ownerId),
        eq(eveConversation.sessionId, sessionId),
        eq(eveConversation.state, "bound")
      )
    );
  if (rows.length < SINGLE_USAGE_MATCH_LIMIT) {
    throw new Error("Conversation not found.");
  }
  const [row] = rows;
  return row.streamIndex;
};

/**
 * Advance only after durable ingestion; concurrent older readers cannot rewind it.
 * @param {string} ownerId Owner whose bound session is authorized.
 * @param {string} sessionId Native session whose billing cursor advances.
 * @param {number} streamIndex Nonnegative safe ingestion index committed after durable usage recording.
 */
const advanceEveUsageCursor = async (
  ownerId: string,
  sessionId: string,
  streamIndex: number
): Promise<void> => {
  if (
    !Number.isSafeInteger(streamIndex) ||
    streamIndex < MINIMUM_USAGE_STREAM_INDEX
  ) {
    throw new Error("Invalid Eve usage cursor.");
  }
  const rows = await db
    .update(eveConversation)
    .set({
      usageStreamIndex: sql`greatest(${eveConversation.usageStreamIndex}, ${streamIndex})`,
    })
    .where(
      and(
        eq(eveConversation.ownerId, ownerId),
        eq(eveConversation.sessionId, sessionId),
        eq(eveConversation.state, "bound")
      )
    )
    .returning({ id: eveConversation.id });
  if (rows.length < SINGLE_USAGE_MATCH_LIMIT) {
    throw new Error("Conversation not found.");
  }
};

/**
 * Serialize managed fallback sweeps across deployments, without locking credit debits.
 * @param {string} ownerId Registered owner whose dedicated reconciliation lock fences the sweep.
 * @param {(sweepDue: boolean, unpricedSessions: Readonly<ReadonlySet<string>>) => Promise<void>} reconcile Recovery callback receiving sweep eligibility and the current unpriced session identities.
 */
const withManagedUsageReconciliation = async (
  ownerId: string,
  reconcile: (
    sweepDue: boolean,
    unpricedSessions: Readonly<ReadonlySet<string>>
  ) => Promise<void>
): Promise<void> => {
  // Recovery queries use the app pool. Holding its only connection here would
  // deadlock deployments configured with DATABASE_MAX_CONNECTIONS=1.
  const settings = databaseConnection(env);
  const connection = postgres(settings.url, {
    ...settings.options,
    max: 1,
    prepare: false,
  });
  try {
    const usageDb = drizzle(connection);
    type UsageLockTransaction = Readonly<
      Pick<typeof usageDb, "select" | "selectDistinct" | "execute" | "update">
    >;
    await usageDb.transaction(async (tx: UsageLockTransaction) => {
      await tx.execute(sql`select set_config('lock_timeout', '5s', true)`);
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`eve-usage:${ownerId}`}, 0))`
      );
      const [owner] = await tx
        .select({
          sweepDue: sql<boolean>`${user.eveUsageReconciledAt} is null or ${user.eveUsageReconciledAt} < clock_timestamp() - interval '1 minute'`,
        })
        .from(user)
        .where(eq(user.id, ownerId));
      const hasOwner = Boolean(owner);
      if (!hasOwner) {
        throw new Error("Usage reconciliation requires a registered owner.");
      }
      const unpricedSessions = await tx
        .selectDistinct({ sessionId: eveUsage.sessionId })
        .from(eveUsage)
        .where(
          and(
            eq(eveUsage.ownerId, ownerId),
            isNull(eveUsage.costUsd),
            isNull(eveUsage.modelAttempt)
          )
        );
      await reconcile(
        owner.sweepDue,
        new Set(unpricedSessions.map((row) => row.sessionId))
      );
      if (owner.sweepDue) {
        // The now() function uses transaction start: a long sweep cannot buy another minute of stale evidence.
        await tx
          .update(user)
          .set({ eveUsageReconciledAt: sql`now()` })
          .where(eq(user.id, ownerId));
      }
    });
  } catch (error) {
    const cause =
      error instanceof Error && Boolean(error.cause) ? error.cause : error;
    if (cause instanceof postgres.PostgresError && cause.code === "55P03") {
      throw new EveUsageReconciliationBusyError();
    }
    throw error;
  } finally {
    await connection.end();
  }
};
export {
  advanceEveUsageCursor,
  getEveUsageCursor,
  recordEveUsage,
  withManagedUsageReconciliation,
};
