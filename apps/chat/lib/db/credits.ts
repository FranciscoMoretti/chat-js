import "server-only";
import { eq, sql } from "drizzle-orm";

import { db } from "./client";
import { userCredit } from "./schema";

const ensureUserCreditRow = async (userId: string): Promise<void> => {
  await db.insert(userCredit).values({ userId }).onConflictDoNothing();
};

/* oxlint-disable import/group-exports, jsdoc/require-param, jsdoc/require-returns, no-magic-numbers  --
 * import/group-exports (#523): getCredits stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named getCredits API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): getCredits's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): getCredits's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * no-magic-numbers (#517): getCredits uses 1, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): getCredits sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): getCredits handles optional rows[0]?.credits without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 */
/**
 * Get user's current credit balance (in cents).
 */
export const getCredits = async (userId: string): Promise<number> => {
  let rows = await db
    .select({ credits: userCredit.credits })
    .from(userCredit)
    .where(eq(userCredit.userId, userId))
    .limit(1);

  if (rows.length === 0) {
    await ensureUserCreditRow(userId);
    rows = await db
      .select({ credits: userCredit.credits })
      .from(userCredit)
      .where(eq(userCredit.userId, userId))
      .limit(1);
  }

  return rows[0]?.credits ?? 0;
};
/* oxlint-enable import/group-exports, jsdoc/require-param, jsdoc/require-returns, no-magic-numbers */

/* oxlint-disable import/group-exports, jsdoc/require-param, jsdoc/require-returns, no-magic-numbers  --
 * import/group-exports (#523): canSpend stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named canSpend API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): canSpend's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): canSpend's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * no-magic-numbers (#517): canSpend uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): canSpend sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 */
/**
 * Check if user has positive credits (can spend).
 */
export const canSpend = async (userId: string): Promise<boolean> => {
  const credits = await getCredits(userId);
  return credits > 0;
};
/* oxlint-enable import/group-exports, jsdoc/require-param, jsdoc/require-returns, no-magic-numbers */

/* oxlint-disable import/group-exports, jsdoc/require-param  --
 * import/group-exports (#523): deductCredits stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named deductCredits API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): deductCredits's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * oxc/no-async-await (#540): deductCredits sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 */
/**
 * Deduct credits from user. Allows going slightly negative for in-progress operations.
 */
export const deductCredits = async (
  userId: string,
  amount: number
): Promise<void> => {
  await ensureUserCreditRow(userId);
  await db
    .update(userCredit)
    .set({
      credits: sql`${userCredit.credits} - ${amount}`,
    })
    .where(eq(userCredit.userId, userId));
};
/* oxlint-enable import/group-exports, jsdoc/require-param */
