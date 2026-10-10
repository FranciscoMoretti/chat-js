import { and, eq, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";

import { db } from "./client";
/* oxlint-disable sort-imports -- Keep db's env validation and postgres(connection) initialization before schema's pgTable construction. */
import { eveConversation, eveGuest } from "./schema";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (claimExpiredEveGuestFamilies); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve claimExpiredEveGuestFamilies's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable sort-imports */

type GuestCleanupTransaction = Readonly<Pick<typeof db, "select" | "update">>;
const SINGLE_FAMILY_LIMIT = 1;
const EMPTY_FAMILY_SIZE = 0;

/* oxlint-disable unicorn/max-nested-calls -- * unicorn/max-nested-calls (#568): claimExpiredEveGuestFamilies keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
/** Claim the next fair attempt; the timestamp is a retry cooldown, not an exclusive lease.
 * @returns {Promise<{ id: string; ownerId: string }[]>} At most one expired guest root identity selected with skip-locked fairness after recording its attempt timestamp; an empty list means no eligible unlocked root was found.
 */
export const claimExpiredEveGuestFamilies = async (): Promise<
  { id: string; ownerId: string }[]
> =>
  await db.transaction(async (tx: GuestCleanupTransaction) => {
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
    return rows;
  });
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable unicorn/max-nested-calls */
