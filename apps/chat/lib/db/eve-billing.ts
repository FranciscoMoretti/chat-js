import { and, eq, sql } from "drizzle-orm";
import { db } from "./client";
import { eveUsage, userCredit } from "./schema";

function hasConflictingCost(stored: string | null, incoming: string | null) {
  return (
    stored !== null && incoming !== null && Number(stored) !== Number(incoming)
  );
}

/** A replay can arrive concurrently with the hook. Both use the same durable event ID. */
export async function recordEveUsage(input: {
  eventId: string;
  sessionId: string;
  turnId: string;
  ownerId: string;
  costUsd?: number;
  generationId?: string;
}) {
  if (
    !input.eventId ||
    (input.costUsd !== undefined &&
      (!Number.isFinite(input.costUsd) || input.costUsd < 0))
  ) {
    throw new Error("Invalid Eve usage evidence.");
  }
  return await db.transaction(async (tx) => {
    await tx
      .insert(userCredit)
      .values({ userId: input.ownerId })
      .onConflictDoNothing();
    await tx
      .select()
      .from(userCredit)
      .where(eq(userCredit.userId, input.ownerId))
      .for("update");
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
    return (costUsd ?? existing?.costUsd) != null;
  });
}
