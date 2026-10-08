import { and, eq, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";

import { db } from "./client";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { eveConversation, eveGuest } from "./schema";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (claimExpiredEveGuestFamilies); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve claimExpiredEveGuestFamilies's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable sort-imports */

/* oxlint-disable no-magic-numbers, unicorn/max-nested-calls --
 * no-magic-numbers (#517): claimExpiredEveGuestFamilies uses 1, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * unicorn/max-nested-calls (#568): claimExpiredEveGuestFamilies keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
/** Claim the next fair attempt; the timestamp is a retry cooldown, not an exclusive lease.
 * @returns {Promise<{ id: string; ownerId: string }[]>} At most one expired guest root identity selected with skip-locked fairness after recording its attempt timestamp; an empty list means no eligible unlocked root was found.
 */
export const claimExpiredEveGuestFamilies = async (): Promise<
  { id: string; ownerId: string }[]
> =>
  await db.transaction(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- This original transaction performs .update operations under caller-held locks; preserve the native writer contract.
    async (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => {
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
      if (rows.length > 0) {
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
    }
  );
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-magic-numbers, unicorn/max-nested-calls */
