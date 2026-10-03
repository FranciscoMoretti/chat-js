import { sql } from "drizzle-orm";

import { db } from "./client";

/* oxlint-disable init-declarations --
 * init-declarations (#507): pending assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 */
let pending: Promise<void> | undefined;
/* oxlint-enable init-declarations */
/* oxlint-disable no-undefined, typescript/explicit-function-return-type, typescript/promise-function-async --
 * no-undefined (#519): checkDatabase uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/explicit-function-return-type (#560): Keep checkDatabase's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/promise-function-async (#606): checkDatabase preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
export const checkDatabase = (): Promise<void> => {
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
/* oxlint-enable no-undefined, typescript/explicit-function-return-type, typescript/promise-function-async */
