import "server-only";
import { eq, sql } from "drizzle-orm";

import { db } from "./client";
import { userCredit } from "./schema";

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve ensureUserCreditRow's awaited sequencing and rejected-Promise behavior. */
const ensureUserCreditRow = async (userId: string): Promise<void> => {
  await db.insert(userCredit).values({ userId }).onConflictDoNothing();
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getCredits's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-magic-numbers --
no-magic-numbers (#517): getCredits uses 1, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions. */
/**
 * Get user's current credit balance (in cents).
 * @param {string} userId - User whose balance is read; a missing credit row is created with the database defaults.
 * @returns {Promise<number>} Stored balance in cents, or zero if the retry still has no balance; database failures reject.
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

  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading credits from rows[0]; preserve one receiver evaluation, skipped accesses and the existing 0 fallback. The app guidance prefers optional chaining.
  return rows[0]?.credits ?? 0;
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve canSpend's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers --
no-magic-numbers (#517): canSpend uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions. */
/**
 * Check if user has positive credits (can spend).
 * @param {string} userId - User whose current balance is read, creating a missing credit row as needed.
 * @returns {Promise<boolean>} Whether the balance is strictly positive; this check does not reserve credits or test a requested amount.
 */
const canSpend = async (userId: string): Promise<boolean> => {
  const credits = await getCredits(userId);
  return credits > 0;
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve deductCredits's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/**
 * Subtract credits without enforcing a minimum balance, allowing in-progress operations to finish.
 * @param {string} userId - User whose credit row is created if missing and then debited.
 * @param {number} amount - Amount in cents to subtract; this helper does not require a positive amount or sufficient balance.
 * @returns {Promise<void>} Resolves after the balance update; database failures reject.
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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (canSpend, deductCredits, getCredits); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
export { canSpend, deductCredits, getCredits };
/* oxlint-enable import/no-named-export */
