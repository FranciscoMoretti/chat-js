import { sql } from "drizzle-orm";

import { db } from "./client";

let pending: Promise<void> | undefined;
export const checkDatabase = async (): Promise<void> => {
  // An unavailable database must not accumulate another query on every probe.
  pending ??= (async (): Promise<void> => {
    try {
      await db.execute(sql`select 1`);
    } finally {
      pending = undefined;
    }
  })();
  await pending;
};
