import "server-only";
import { eq, sql } from "drizzle-orm";

import { db } from "./client";
import { userCredit } from "./schema";

const ensureUserCreditRow = async (userId: string) => {
  await db.insert(userCredit).values({ userId }).onConflictDoNothing();
};

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

/**
 * Check if user has positive credits (can spend).
 */
export const canSpend = async (userId: string): Promise<boolean> => {
  const credits = await getCredits(userId);
  return credits > 0;
};

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

/**
 * Add credits to user (for purchases, refunds, etc).
 */
const _addCredits = async (userId: string, amount: number): Promise<void> => {
  await ensureUserCreditRow(userId);
  await db
    .update(userCredit)
    .set({
      credits: sql`${userCredit.credits} + ${amount}`,
    })
    .where(eq(userCredit.userId, userId));
};
