/* oxlint-disable import/no-relative-parent-imports, sort-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../env"; "../eve/usage-reconciliation-busy" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "../env";
import { EveUsageReconciliationBusyError } from "../eve/usage-reconciliation-busy";
import { db } from "./client";
import { databaseConnection } from "./connection";
import {
  eveConversation,
  eveGuest,
  eveUsage,
  user,
  userCredit,
} from "./schema";
/* oxlint-enable import/no-relative-parent-imports, sort-imports */

const hasConflictingCost = (
  stored: string | null,
  incoming: string | null
): boolean =>
  stored !== null && incoming !== null && Number(stored) !== Number(incoming);

/* oxlint-disable no-magic-numbers, oxc/no-async-await, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types --
 * no-magic-numbers (#517): debitTurnUsage uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): debitTurnUsage sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): debitTurnUsage handles optional totals?.due; totals?.paid without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/prefer-readonly-parameter-types (#565): debitTurnUsage accepts tx: Parameters<Parameters<typeof db.transaction>[0]>[0]; input: { ownerId: string; sessionId: string; turnId: string; eventId: string; }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const debitTurnUsage = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
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
  const delta = (totals?.due ?? 0) - (totals?.paid ?? 0);
  if (delta > 0) {
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
/* oxlint-enable no-magic-numbers, oxc/no-async-await, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, import/no-named-export, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, no-ternary, no-undefined, oxc/no-async-await, oxc/no-optional-chaining, oxc/no-rest-spread-properties, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null --
 * import/group-exports (#523): recordEveUsage stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named recordEveUsage API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): recordEveUsage's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): recordEveUsage's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): recordEveUsage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): recordEveUsage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): recordEveUsage uses 0, 12 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): recordEveUsage derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): recordEveUsage uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): recordEveUsage sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): recordEveUsage handles optional existing?.costUsd without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * oxc/no-rest-spread-properties (#543): recordEveUsage copies or separates ...input while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/prefer-readonly-parameter-types (#565): recordEveUsage accepts input: { eventId: string; sessionId: string; turnId: string; ownerId: string; costUsd; tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): recordEveUsage intentionally keeps the existing falsy-value behavior of settled; guest; existing; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): recordEveUsage preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
/** A replay can arrive concurrently with the hook. Both use the same durable event ID. */
export const recordEveUsage = async (input: {
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
      (!Number.isFinite(input.costUsd) || input.costUsd < 0))
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
      input.costUsd === undefined ? null : input.costUsd.toFixed(12);
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
      input.costUsd === undefined ? null : input.costUsd.toFixed(12);
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
/* oxlint-enable import/group-exports, import/no-named-export, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, no-ternary, no-undefined, oxc/no-async-await, oxc/no-optional-chaining, oxc/no-rest-spread-properties, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable import/group-exports, import/no-named-export, jsdoc/require-param, jsdoc/require-returns, oxc/no-async-await, typescript/strict-boolean-expressions --
 * import/group-exports (#523): getEveUsageCursor stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named getEveUsageCursor API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): getEveUsageCursor's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): getEveUsageCursor's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * oxc/no-async-await (#540): getEveUsageCursor sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/strict-boolean-expressions (#610): getEveUsageCursor intentionally keeps the existing falsy-value behavior of row; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** This cursor is billing progress, never a second copy of the transcript. */
export const getEveUsageCursor = async (
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
/* oxlint-enable import/group-exports, import/no-named-export, jsdoc/require-param, jsdoc/require-returns, oxc/no-async-await, typescript/strict-boolean-expressions */

/* oxlint-disable import/group-exports, import/no-named-export, jsdoc/require-param, no-magic-numbers, oxc/no-async-await, typescript/strict-boolean-expressions --
 * import/group-exports (#523): advanceEveUsageCursor stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named advanceEveUsageCursor API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): advanceEveUsageCursor's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * no-magic-numbers (#517): advanceEveUsageCursor uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): advanceEveUsageCursor sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/strict-boolean-expressions (#610): advanceEveUsageCursor intentionally keeps the existing falsy-value behavior of row; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** Advance only after durable ingestion; concurrent older readers cannot rewind it. */
export const advanceEveUsageCursor = async (
  ownerId: string,
  sessionId: string,
  streamIndex: number
): Promise<void> => {
  if (!Number.isSafeInteger(streamIndex) || streamIndex < 0) {
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
/* oxlint-enable import/group-exports, import/no-named-export, jsdoc/require-param, no-magic-numbers, oxc/no-async-await, typescript/strict-boolean-expressions */

/* oxlint-disable import/group-exports, import/no-named-export, jsdoc/require-param, max-lines-per-function, max-statements, no-magic-numbers, no-ternary, oxc/no-async-await, oxc/no-rest-spread-properties, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * import/group-exports (#523): withManagedUsageReconciliation stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named withManagedUsageReconciliation API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): withManagedUsageReconciliation's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): withManagedUsageReconciliation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): withManagedUsageReconciliation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): withManagedUsageReconciliation uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): withManagedUsageReconciliation derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * oxc/no-async-await (#540): withManagedUsageReconciliation sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): withManagedUsageReconciliation copies or separates ...settings.options while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/prefer-readonly-parameter-types (#565): withManagedUsageReconciliation accepts unpricedSessions: Set<string>; tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): withManagedUsageReconciliation intentionally keeps the existing falsy-value behavior of owner; unpriced; error.cause; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** Serialize managed fallback sweeps across deployments, without locking credit debits. */
export const withManagedUsageReconciliation = async (
  ownerId: string,
  reconcile: (sweepDue: boolean, unpricedSessions: Set<string>) => Promise<void>
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
        .limit(1);
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
/* oxlint-enable import/group-exports, import/no-named-export, jsdoc/require-param, max-lines-per-function, max-statements, no-magic-numbers, no-ternary, oxc/no-async-await, oxc/no-rest-spread-properties, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
