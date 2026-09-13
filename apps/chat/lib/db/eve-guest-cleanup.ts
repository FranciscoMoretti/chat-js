import { and, eq, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import { db } from "./client";
import { eveConversation, eveGuest } from "./schema";

/** Claim the next fair attempt; the timestamp is a retry cooldown, not an exclusive lease. */
export async function claimExpiredEveGuestFamilies() {
  return await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: eveConversation.id, ownerId: eveConversation.ownerId })
      .from(eveConversation)
      .innerJoin(eveGuest, eq(eveGuest.ownerId, eveConversation.ownerId))
      .where(
        and(
          lte(eveGuest.expiresAt, sql`now()`),
          isNull(eveConversation.rootConversationId),
          ne(eveConversation.state, "deleted"),
          or(
            isNull(eveConversation.guestCleanupAttemptedAt),
            lte(
              eveConversation.guestCleanupAttemptedAt,
              sql`now() - interval '5 minutes'`
            )
          )
        )
      )
      .orderBy(
        sql`${eveConversation.guestCleanupAttemptedAt} asc nulls first`,
        eveConversation.id
      )
      .limit(1)
      .for("update", { of: eveConversation, skipLocked: true });
    if (rows.length) {
      await tx
        .update(eveConversation)
        .set({ guestCleanupAttemptedAt: sql`now()` })
        .where(
          inArray(
            eveConversation.id,
            rows.map((row) => row.id)
          )
        );
    }
    return rows;
  });
}
