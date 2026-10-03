/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { and, eq, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";

import { db } from "./client";
import { eveConversation, eveGuest } from "./schema";
/* oxlint-enable sort-imports */

/* oxlint-disable import/no-named-export, import/prefer-default-export, jsdoc/require-returns, no-magic-numbers, oxc/no-async-await, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls --
 * import/no-named-export (#527): Preserve the named claimExpiredEveGuestFamilies API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): claimExpiredEveGuestFamilies remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * jsdoc/require-returns (#535): claimExpiredEveGuestFamilies's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * no-magic-numbers (#517): claimExpiredEveGuestFamilies uses 1, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): claimExpiredEveGuestFamilies sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep claimExpiredEveGuestFamilies's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep claimExpiredEveGuestFamilies's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): claimExpiredEveGuestFamilies accepts tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * unicorn/max-nested-calls (#568): claimExpiredEveGuestFamilies keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
/** Claim the next fair attempt; the timestamp is a retry cooldown, not an exclusive lease. */
export const claimExpiredEveGuestFamilies = async () =>
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
/* oxlint-enable import/no-named-export, import/prefer-default-export, jsdoc/require-returns, no-magic-numbers, oxc/no-async-await, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls */
