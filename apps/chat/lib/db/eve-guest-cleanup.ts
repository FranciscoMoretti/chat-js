import { and, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";

import { db } from "./client";
import { eveConversation, eveGuest } from "./schema";

type GuestCleanupTransaction = Readonly<Pick<typeof db, "select" | "update">>;
const SINGLE_FAMILY_LIMIT = 1;
const EMPTY_FAMILY_SIZE = 0;
// A deleted root may still have surviving branches. Keep its family discoverable.
const hasLiveFamily = sql`exists (
  select 1 from "EveConversation" member
  where member."chatId" = ${eveConversation.chatId}
    and member."ownerId" = ${eveConversation.ownerId}
    and member.state <> 'deleted'
)`;

/** Claim the next fair attempt; the timestamp is a retry cooldown, not an exclusive lease.
 * @returns {Promise<{ id: string; ownerId: string }[]>} At most one expired guest chat identity, selected through its root with skip-locked fairness after recording its attempt timestamp; an empty list means no eligible unlocked root was found.
 */
export const claimExpiredEveGuestFamilies = async (): Promise<
  { id: string; ownerId: string }[]
> =>
  await db.transaction(async (tx: GuestCleanupTransaction) => {
    const rows = await tx
      .select({
        id: eveConversation.id,
        chatId: eveConversation.chatId,
        ownerId: eveConversation.ownerId,
      })
      .from(eveConversation)
      .innerJoin(eveGuest, eq(eveGuest.ownerId, eveConversation.ownerId))
      .where(
        and(
          lte(eveGuest.expiresAt, sql`now()`),
          isNull(eveConversation.rootConversationId),
          hasLiveFamily,
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
      .limit(SINGLE_FAMILY_LIMIT)
      .for("update", { of: eveConversation, skipLocked: true });
    if (rows.length > EMPTY_FAMILY_SIZE) {
      await tx
        .update(eveConversation)
        .set({ guestCleanupAttemptedAt: sql`now()` })
        .where(
          inArray(
            eveConversation.id,
            rows.map((row: { readonly id: string }) => row.id)
          )
        );
    }
    // Chat IDs intentionally select every family member for expiry cleanup;
    // user-requested conversation IDs remain branch-scoped.
    return rows.map((row) => ({ id: row.chatId, ownerId: row.ownerId }));
  });

/** Read-only inventory: unsupported providers may report an empty sweep only after this succeeds. */
export const hasExpiredEveGuestFamilies = async (): Promise<boolean> => {
  const rows = await db
    .select({ id: eveConversation.id })
    .from(eveConversation)
    .innerJoin(eveGuest, eq(eveGuest.ownerId, eveConversation.ownerId))
    .where(
      and(
        lte(eveGuest.expiresAt, sql`now()`),
        isNull(eveConversation.rootConversationId),
        hasLiveFamily
      )
    )
    .limit(1);
  return rows.length > 0;
};
