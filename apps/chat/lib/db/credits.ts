import "server-only";
import { eq, sql } from "drizzle-orm";

import { db } from "./client";
import { userCredit } from "./schema";

const ensureUserCreditRow = async (userId: string): Promise<void> => {
  await db.insert(userCredit).values({ userId }).onConflictDoNothing();
};

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, no-magic-numbers -- jsdoc/require-param (#534): getCredits's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): getCredits's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
no-magic-numbers (#517): getCredits uses 1, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions. */
/**
 * Get user's current credit balance (in cents).
 */
const getCredits = async (userId: string): Promise<number> => {
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, no-magic-numbers */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, no-magic-numbers -- jsdoc/require-param (#534): canSpend's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): canSpend's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
no-magic-numbers (#517): canSpend uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions. */
/**
 * Check if user has positive credits (can spend).
 */
const canSpend = async (userId: string): Promise<boolean> => {
  const credits = await getCredits(userId);
  return credits > 0;
};
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, no-magic-numbers */

/* oxlint-disable jsdoc/require-param -- jsdoc/require-param (#534): deductCredits's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags. */
/**
 * Deduct credits from user. Allows going slightly negative for in-progress operations.
 */
const deductCredits = async (userId: string, amount: number): Promise<void> => {
  await ensureUserCreditRow(userId);
  await db
    .update(userCredit)
    .set({
      credits: sql`${userCredit.credits} - ${amount}`,
    })
    .where(eq(userCredit.userId, userId));
};
/* oxlint-enable jsdoc/require-param */
export { canSpend, deductCredits, getCredits };
