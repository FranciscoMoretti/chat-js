import { sql } from "drizzle-orm";

import { db } from "./client";

let pending: Promise<void> | undefined;
export const checkDatabase = () => {
  // An unavailable database must not accumulate another query on every probe.
  pending ??= (async () => {
    try {
      await db.execute(sql`select 1`);
    } finally {
      pending = undefined;
    }
  })();
  return pending;
};
