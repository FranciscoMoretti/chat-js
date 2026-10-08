/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/schema"; "../lib/eve/search-backfill"; "../lib/eve/server" dependency within this package instead of introducing an alias or barrel API.
 */
/* oxlint-disable eslint/no-await-in-loop -- Sequential snapshots bound worker load and make retries predictable. */
import { and, asc, eq, gt } from "drizzle-orm";

import { db } from "../lib/db/client";
import { eveConversation } from "../lib/db/schema";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { backfillEveSearchConversation } from "../lib/eve/search-backfill";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { assertEveConfigured } from "../lib/eve/server";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve main's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable init-declarations, max-statements, no-console, no-continue, no-magic-numbers, no-undefined --
 * init-declarations (#507): main assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * max-statements (#512): main keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-console (#514): main emits operational command/error diagnostics through console; selecting another logging transport requires a runtime-specific decision.
 * no-continue (#515): main skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 * no-magic-numbers (#517): main uses 50, 0, 1, -1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-undefined (#519): main uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
const main = async (): Promise<void> => {
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
          // oxlint-disable-next-line no-ternary -- Keep and argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          typeof cursor === "string" && cursor !== ""
            ? gt(eveConversation.id, cursor)
            : undefined
        )
      )
      .orderBy(asc(eveConversation.id))
      .limit(50);
    if (batch.length === 0) {
      break;
    }
    for (const conversation of batch) {
      if (conversation.sessionId === null || conversation.sessionId === "") {
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
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading id from batch.at(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    cursor = batch.at(-1)?.id;
    console.info(`Search backfill: ${indexed} indexed, ${failed} failed.`);
  }
  // oxlint-disable-next-line unicorn/no-process-exit, no-ternary -- unicorn/no-process-exit: The one-shot command has no database teardown and must terminate after reporting its aggregate status.; no-ternary: Keep the exit-code selection inline; if/else assignment conflicts with pinned unicorn/prefer-ternary.
  process.exit(failed ? 1 : 0);
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this statement's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable init-declarations, max-statements, no-console, no-continue, no-magic-numbers, no-undefined */
/* oxlint-disable no-console --
 * no-console (#514): void (async () => { try { await main(); } catch (error) emits operational command/error diagnostics through console; selecting another logging transport requires a runtime-specific decision.
 */
// oxlint-disable-next-line unicorn/prefer-top-level-await -- #574: This entrypoint also runs through tsx in CommonJS packages, which cannot compile top-level await.
void (async (): Promise<void> => {
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-console */
