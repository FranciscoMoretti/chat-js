import type { db } from "@/lib/db/client";

/** Optional monetary policy. Native EVE and Next.js must both be able to load it. */
export interface UsageBilling {
  readonly canSpend: (ownerId: string) => Promise<boolean>;
  /** Same transaction as usage evidence and chargedCents; throw to roll back all three. */
  readonly debit: (
    tx: Readonly<Pick<typeof db, "insert" | "update">>,
    input: { readonly ownerId: string; readonly cents: number }
  ) => Promise<void>;
}
