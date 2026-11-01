import { sql } from "drizzle-orm";
import type { db } from "./client";

/** Consistent owner lock ordering for ownership changes and cleanup. */
export const lockEveFamilies = async (
  tx: Readonly<Pick<typeof db, "execute">>,
  owners: readonly string[]
): Promise<void> => {
  for (const owner of [...new Set(owners)].toSorted()) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Sorted acquisition avoids deadlocks when cleanup spans multiple owners.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${owner}`}, 0))`
    );
  }
};
