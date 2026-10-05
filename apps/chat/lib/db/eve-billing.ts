import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { env } from "@/lib/env";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { EveUsageReconciliationBusyError } from "@/lib/eve/usage-reconciliation-busy";
/* oxlint-enable sort-imports */

import { db } from "./client";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { databaseConnection } from "./connection";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  eveConversation,
  eveGuest,
  eveUsage,
  user,
  userCredit,
} from "./schema";
/* oxlint-enable sort-imports */

const FIRST_PARAMETER_INDEX = 0;
const NO_CHARGED_CENTS = 0;
const MINIMUM_COST_USD = 0;
const COST_DECIMAL_PLACES = 12;
const MINIMUM_USAGE_STREAM_INDEX = 0;
const SINGLE_USAGE_MATCH_LIMIT = 1;

type UsageTransaction = Parameters<
  Parameters<typeof db.transaction>[typeof FIRST_PARAMETER_INDEX]
>[typeof FIRST_PARAMETER_INDEX];

const hasConflictingCost = (
  stored: string | null,
  incoming: string | null
): boolean =>
  stored !== null && incoming !== null && Number(stored) !== Number(incoming);

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve debitTurnUsage's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable typescript/prefer-readonly-parameter-types --
 * typescript/prefer-readonly-parameter-types (#565): debitTurnUsage accepts tx: UsageTransaction; input: { ownerId: string; sessionId: string; turnId: string; eventId: string; }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const debitTurnUsage = async (
  tx: UsageTransaction,
  input: {
    ownerId: string;
    sessionId: string;
    turnId: string;
    eventId: string;
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
  const delta =
    (totals?.due ?? NO_CHARGED_CENTS) - (totals?.paid ?? NO_CHARGED_CENTS);
  if (delta > NO_CHARGED_CENTS) {
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve recordEveUsage's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-lines-per-function, max-statements, no-undefined, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null --max-lines-per-function (#510): recordEveUsage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): recordEveUsage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-undefined (#519): recordEveUsage uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
typescript/prefer-readonly-parameter-types (#565): recordEveUsage accepts input: { eventId: string; sessionId: string; turnId: string; ownerId: string; costUsd; tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): recordEveUsage intentionally keeps the existing falsy-value behavior of settled; guest; existing; distinguishing empty, zero, and absent states requires a domain behavior decision.
unicorn/no-null (#570): recordEveUsage preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
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
  eventId: string;
  sessionId: string;
  turnId: string;
  ownerId: string;
  costUsd?: number;
  generationId?: string;
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
  if (settled) {
    const incoming =
      input.costUsd === undefined
        ? null
        : input.costUsd.toFixed(COST_DECIMAL_PLACES);
    if (hasConflictingCost(settled.costUsd, incoming)) {
      throw new Error("Eve usage amount changed; reconcile provider evidence.");
    }
    return true;
  }
  return await db.transaction(async (tx) => {
    const [guest] = await tx
      .select({ ownerId: eveGuest.ownerId })
      .from(eveGuest)
      .where(eq(eveGuest.ownerId, input.ownerId))
      .for("update");
    if (!guest) {
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
    if (existing) {
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
      if (existing.costUsd === null && costUsd !== null) {
        await tx
          .update(eveUsage)
          .set({ costUsd, generationId: input.generationId })
          .where(eq(eveUsage.eventId, input.eventId));
      }
    } else {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing input own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      await tx.insert(eveUsage).values({ ...input, costUsd });
    }
    // Guest admission spends message quota. Keep provider costs without granting
    // signup credit or mixing monetary debits into that separate allowance.
    if (!guest) {
      await debitTurnUsage(tx, input);
    }
    const recordedCost = costUsd ?? existing?.costUsd;
    return recordedCost !== null && recordedCost !== undefined;
  });
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getEveUsageCursor's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-statements, no-undefined, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable typescript/strict-boolean-expressions --typescript/strict-boolean-expressions (#610): getEveUsageCursor intentionally keeps the existing falsy-value behavior of row; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
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
  const [row] = await db
    .select({ streamIndex: eveConversation.usageStreamIndex })
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.ownerId, ownerId),
        eq(eveConversation.sessionId, sessionId),
        eq(eveConversation.state, "bound")
      )
    );
  if (!row) {
    throw new Error("Conversation not found.");
  }
  return row.streamIndex;
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve advanceEveUsageCursor's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/strict-boolean-expressions */

/* oxlint-disable typescript/strict-boolean-expressions --typescript/strict-boolean-expressions (#610): advanceEveUsageCursor intentionally keeps the existing falsy-value behavior of row; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
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
  const [row] = await db
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
  if (!row) {
    throw new Error("Conversation not found.");
  }
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve withManagedUsageReconciliation's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/strict-boolean-expressions */

/* oxlint-disable max-lines-per-function, max-statements, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --max-lines-per-function (#510): withManagedUsageReconciliation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): withManagedUsageReconciliation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
typescript/prefer-readonly-parameter-types (#565): withManagedUsageReconciliation accepts unpricedSessions: Set<string>; tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): withManagedUsageReconciliation intentionally keeps the existing falsy-value behavior of owner; unpriced; error.cause; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/**
 * Serialize managed fallback sweeps across deployments, without locking credit debits.
 * @param {string} ownerId Registered owner whose dedicated reconciliation lock fences the sweep.
 * @param {(sweepDue: boolean, unpricedSessions: Set<string>) => Promise<void>} reconcile Recovery callback receiving sweep eligibility and the current unpriced session identities.
 */
const withManagedUsageReconciliation = async (
  ownerId: string,
  reconcile: (sweepDue: boolean, unpricedSessions: Set<string>) => Promise<void>
): Promise<void> => {
  // Recovery queries use the app pool. Holding its only connection here would
  // deadlock deployments configured with DATABASE_MAX_CONNECTIONS=1.
  const settings = databaseConnection(env);
  const connection = postgres(settings.url, {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing settings.options own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...settings.options,
    max: 1,
    prepare: false,
  });
  try {
    await drizzle(connection).transaction(async (tx) => {
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
      if (!owner) {
        throw new Error("Usage reconciliation requires a registered owner.");
      }
      const unpricedSessions = await tx
        .selectDistinct({ sessionId: eveUsage.sessionId })
        .from(eveUsage)
        .where(and(eq(eveUsage.ownerId, ownerId), isNull(eveUsage.costUsd)));
      await reconcile(
        owner.sweepDue,
        new Set(unpricedSessions.map((row) => row.sessionId))
      );
      // A recorded but unpriced hook must block admission even during the cooldown.
      const [unpriced] = await tx
        .select({ id: eveUsage.eventId })
        .from(eveUsage)
        .where(and(eq(eveUsage.ownerId, ownerId), isNull(eveUsage.costUsd)))
        .limit(SINGLE_USAGE_MATCH_LIMIT);
      if (unpriced) {
        throw new Error(
          "Completed usage needs provider cost reconciliation before starting more work."
        );
      }
      if (owner.sweepDue) {
        // The now() function uses transaction start: a long sweep cannot buy another minute of stale evidence.
        await tx
          .update(user)
          .set({ eveUsageReconciledAt: sql`now()` })
          .where(eq(user.id, ownerId));
      }
    });
  } catch (error) {
    const cause = error instanceof Error && error.cause ? error.cause : error;
    if (cause instanceof postgres.PostgresError && cause.code === "55P03") {
      throw new EveUsageReconciliationBusyError();
    }
    throw error;
  } finally {
    await connection.end();
  }
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (advanceEveUsageCursor, getEveUsageCursor, recordEveUsage, withManagedUsageReconciliation); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
export {
  advanceEveUsageCursor,
  getEveUsageCursor,
  recordEveUsage,
  withManagedUsageReconciliation,
};
/* oxlint-enable import/no-named-export */
