import { and, eq, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";

import { db } from "./client";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { eveConversation, eveGuest } from "./schema";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (claimExpiredEveGuestFamilies); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve claimExpiredEveGuestFamilies's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable sort-imports */

/* oxlint-disable jsdoc/require-returns, no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls --
 * jsdoc/require-returns (#535): claimExpiredEveGuestFamilies's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * no-magic-numbers (#517): claimExpiredEveGuestFamilies uses 1, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): claimExpiredEveGuestFamilies accepts tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * unicorn/max-nested-calls (#568): claimExpiredEveGuestFamilies keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
/** Claim the next fair attempt; the timestamp is a retry cooldown, not an exclusive lease. */
export const claimExpiredEveGuestFamilies = async (): Promise<
  { id: string; ownerId: string }[]
> =>
  await db.transaction(async (tx) => {
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
            rows.map((row) => row.id)
          )
        );
    }
    return rows;
  });
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable jsdoc/require-returns, no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls */
