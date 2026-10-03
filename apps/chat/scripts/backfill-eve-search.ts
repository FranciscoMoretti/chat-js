/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/schema"; "../lib/eve/search-backfill"; "../lib/eve/server" dependency within this package instead of introducing an alias or barrel API.
 */
/* oxlint-disable eslint/no-await-in-loop -- Sequential snapshots bound worker load and make retries predictable. */
import { asc, eq, gt, and } from "drizzle-orm";

import { db } from "../lib/db/client";
import { eveConversation } from "../lib/db/schema";
import { backfillEveSearchConversation } from "../lib/eve/search-backfill";
import { assertEveConfigured } from "../lib/eve/server";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable init-declarations, max-statements, no-console, no-continue, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/strict-boolean-expressions --
 * init-declarations (#507): main assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * max-statements (#512): main keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-console (#514): main emits operational command/error diagnostics through console; selecting another logging transport requires a runtime-specific decision.
 * no-continue (#515): main skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 * no-magic-numbers (#517): main uses 50, 0, 1, -1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-undefined (#519): main uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/explicit-function-return-type (#560): Keep main's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/strict-boolean-expressions (#610): main intentionally keeps the existing falsy-value behavior of cursor; conversation.sessionId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const main = async () => {
  assertEveConfigured();
  let cursor: string | undefined;
  let indexed = 0;
  let failed = 0;
  while (true) {
    const batch = await db
      .select({
        id: eveConversation.id,
        ownerId: eveConversation.ownerId,
        sessionId: eveConversation.sessionId,
      })
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.state, "bound"),
          cursor ? gt(eveConversation.id, cursor) : undefined
        )
      )
      .orderBy(asc(eveConversation.id))
      .limit(50);
    if (batch.length === 0) {
      break;
    }
    for (const conversation of batch) {
      if (!conversation.sessionId) {
        continue;
      }
      try {
        await backfillEveSearchConversation(
          conversation.ownerId,
          conversation.id,
          conversation.sessionId
        );
        indexed += 1;
      } catch (error) {
        failed += 1;
        console.error(
          `Search backfill failed for conversation ${conversation.id}; rerun to retry.`,
          error
        );
      }
    }
    cursor = batch.at(-1)?.id;
    console.info(`Search backfill: ${indexed} indexed, ${failed} failed.`);
  }
  // oxlint-disable-next-line unicorn/no-process-exit -- #571: The one-shot backfill terminates with its aggregate result while the shared database pool remains open.
  process.exit(failed ? 1 : 0);
};
/* oxlint-enable init-declarations, max-statements, no-console, no-continue, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/strict-boolean-expressions */
/* oxlint-disable no-console, typescript/explicit-function-return-type --
 * no-console (#514): void (async () => { try { await main(); } catch (error) emits operational command/error diagnostics through console; selecting another logging transport requires a runtime-specific decision.
 * typescript/explicit-function-return-type (#560): Keep void (async () => { try { await main(); } catch (error)'s return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
// oxlint-disable-next-line unicorn/prefer-top-level-await -- #574: This entrypoint also runs through tsx in CommonJS packages, which cannot compile top-level await.
void (async () => {
  try {
    await main();
  } catch (error) {
    console.error(
      "Search backfill could not start. Check the database and EVE configuration.",
      error
    );
    process.exitCode = 1;
  }
})();
/* oxlint-enable no-console, typescript/explicit-function-return-type */
