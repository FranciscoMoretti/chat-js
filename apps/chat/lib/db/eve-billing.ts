import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "../env";
import { db } from "./client";
import { databaseConnection } from "./connection";
import {
  eveConversation,
  eveGuest,
  eveUsage,
  user,
  userCredit,
} from "./schema";

const hasConflictingCost = (stored: string | null, incoming: string | null) =>
  stored !== null && incoming !== null && Number(stored) !== Number(incoming);

const debitTurnUsage = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: {
    ownerId: string;
    sessionId: string;
    turnId: string;
    eventId: string;
  }
) => {
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

/** A replay can arrive concurrently with the hook. Both use the same durable event ID. */
export const recordEveUsage = async (input: {
  eventId: string;
  sessionId: string;
  turnId: string;
  ownerId: string;
  costUsd?: number;
  generationId?: string;
}) => {
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

/** This cursor is billing progress, never a second copy of the transcript. */
export const getEveUsageCursor = async (ownerId: string, sessionId: string) => {
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

/** Advance only after durable ingestion; concurrent older readers cannot rewind it. */
export const advanceEveUsageCursor = async (
  ownerId: string,
  sessionId: string,
  streamIndex: number
) => {
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

/** Serialize managed fallback sweeps across deployments, without locking credit debits. */
export const withManagedUsageReconciliation = async (
  ownerId: string,
  reconcile: (sweepDue: boolean, unpricedSessions: Set<string>) => Promise<void>
) => {
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
        // now() is transaction start: a long sweep cannot buy another minute of stale evidence.
        await tx
          .update(user)
          .set({ eveUsageReconciledAt: sql`now()` })
          .where(eq(user.id, ownerId));
      }
    });
  } finally {
    await connection.end();
  }
};
