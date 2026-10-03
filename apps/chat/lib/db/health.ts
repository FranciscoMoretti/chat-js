import { sql } from "drizzle-orm";

import { db } from "./client";

/* oxlint-disable init-declarations --
 * init-declarations (#507): pending assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 */
let pending: Promise<void> | undefined;
/* oxlint-enable init-declarations */
/* oxlint-disable no-undefined, typescript/explicit-function-return-type, typescript/promise-function-async  --
 * import/no-named-export (#527): Preserve the named checkDatabase API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): checkDatabase remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * no-undefined (#519): checkDatabase uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): checkDatabase sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
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
