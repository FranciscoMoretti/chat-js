import { sql } from "drizzle-orm";

import { db } from "./client";

let pending: Promise<void> | undefined;
export function checkDatabase() {
  // An unavailable database must not accumulate another query on every probe.
  pending ??= db
    .execute(sql`select 1`)
    .then(() => undefined)
    .finally(() => {
      pending = undefined;
    });
  return pending;
}
