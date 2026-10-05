import { sql } from "drizzle-orm";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { db } from "./client";
/* oxlint-enable sort-imports */

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
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this statement's awaited sequencing and rejected-Promise behavior. */
  // An unavailable database must not accumulate another query on every probe.
  pending ??= (async () => {
    try {
      await db.execute(sql`select 1`);
    } finally {
      pending = undefined;
    }
  })();
  /* oxlint-enable oxc/no-async-await */
  return pending;
};
/* oxlint-enable no-undefined, typescript/explicit-function-return-type, typescript/promise-function-async */
