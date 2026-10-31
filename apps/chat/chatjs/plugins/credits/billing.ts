import { eq, sql } from "drizzle-orm";
import type { UsageBilling } from "@/chatjs/core/billing/contracts";
import { getBalanceCents } from "./credits-queries";
import { userCredit } from "./credits-schema";

/** Core supplies its usage transaction, with the registered owner already locked. */
export const creditsBilling = {
  canSpend: async (ownerId) => (await getBalanceCents(ownerId)) > 0,
  debit: async (tx, { ownerId, cents }) => {
    await tx
      .insert(userCredit)
      .values({ userId: ownerId })
      .onConflictDoNothing();
    await tx
      .update(userCredit)
      .set({ balanceCents: sql`${userCredit.balanceCents} - ${cents}` })
      .where(eq(userCredit.userId, ownerId));
  },
} satisfies UsageBilling;
