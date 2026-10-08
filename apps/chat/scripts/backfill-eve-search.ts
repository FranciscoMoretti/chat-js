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

const DATABASE_SHUTDOWN_TIMEOUT_SECONDS = 5;
const MILLISECONDS_PER_SECOND = 1000;
const DATABASE_SHUTDOWN_TIMEOUT_MILLISECONDS =
  DATABASE_SHUTDOWN_TIMEOUT_SECONDS * MILLISECONDS_PER_SECOND;
const SHUTDOWN_OUTPUT_FLUSH_TIMEOUT_MILLISECONDS = 250;
const BACKFILL_BATCH_SIZE = 50;
const FAILURE_EXIT_STATUS = 1;
const SUCCESS_EXIT_STATUS = 0;

/* oxlint-disable init-declarations, max-statements, no-console, no-continue, no-magic-numbers, no-undefined --
 * init-declarations (#507): main assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * max-statements (#512): main keeps the sequential backfill workflow together; splitting its loop into helpers would obscure that order.
 * no-console (#514): main emits operational command/error diagnostics through console; selecting another logging transport requires a runtime-specific decision.
 * no-continue (#515): main skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 * no-magic-numbers (#517): main uses 0 for counters/empty values and -1 to read the final batch row; naming standard array and counter values would obscure their meaning.
 * no-undefined (#519): selectNextBatch uses undefined for Drizzle's optional cursor predicate; substituting null would alter its filter contract.
 */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve selectNextBatch's awaited database query and main's ordered sequencing. */
type BackfillConversation = Pick<
  typeof eveConversation.$inferSelect,
  "id" | "ownerId" | "sessionId"
>;

const selectNextBatch = async (
  cursor: string | undefined
): Promise<BackfillConversation[]> => {
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
    .limit(BACKFILL_BATCH_SIZE);
  return batch;
};

const main = async (): Promise<number> => {
  assertEveConfigured();
  let cursor: string | undefined;
  let indexed = 0;
  let failed = 0;
  while (true) {
    const batch = await selectNextBatch(cursor);
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
  if (failed > 0) {
    return FAILURE_EXIT_STATUS;
  }
  return SUCCESS_EXIT_STATUS;
};

/* oxlint-disable promise/avoid-new, eslint/no-promise-executor-return, typescript/strict-void-return --
 * Node's Writable.write callback signals when pending stdout/stderr output has flushed; wrap it in Promises so the timeout path can bound the flush before exiting.
 */
const flushOutputBeforeForcedExit = async (): Promise<void> => {
  await Promise.race([
    Promise.all([
      new Promise<void>((resolve) => {
        process.stdout.write("", () => resolve());
      }),
      new Promise<void>((resolve) => {
        process.stderr.write("", () => resolve());
      }),
    ]),
    new Promise<void>((resolve) => {
      setTimeout(() => resolve(), SHUTDOWN_OUTPUT_FLUSH_TIMEOUT_MILLISECONDS);
    }),
  ]);
};
/* oxlint-enable promise/avoid-new, eslint/no-promise-executor-return, typescript/strict-void-return */

const shutdownDatabase = async (exitStatus: number): Promise<number> => {
  let shutdownExitStatus = exitStatus;
  const shutdownStartedAt = performance.now();
  try {
    await db.$client.end({ timeout: DATABASE_SHUTDOWN_TIMEOUT_SECONDS });
  } catch (error) {
    console.error("Search backfill database shutdown failed.", error);
    shutdownExitStatus = FAILURE_EXIT_STATUS;
  }
  if (
    performance.now() - shutdownStartedAt >=
    DATABASE_SHUTDOWN_TIMEOUT_MILLISECONDS
  ) {
    console.error(
      "Search backfill database shutdown timed out; forcing process exit."
    );
    await flushOutputBeforeForcedExit();
    // oxlint-disable-next-line unicorn/no-process-exit -- postgres@3.4.9 end({ timeout }) can resolve after its deadline while a half-open peer keeps the socket active; this CLI must exit after a bounded output-flush window.
    process.exit(FAILURE_EXIT_STATUS);
  }
  return shutdownExitStatus;
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable init-declarations, max-statements, no-console, no-continue, no-magic-numbers, no-undefined */
/* oxlint-disable no-console --
 * no-console (#514): The entrypoint emits operational startup and database-shutdown diagnostics through console; selecting another logging transport requires a runtime-specific decision.
 */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve main and database shutdown sequencing. */
// oxlint-disable-next-line unicorn/prefer-top-level-await -- #574: This entrypoint also runs through tsx in CommonJS packages, which cannot compile top-level await.
void (async (): Promise<void> => {
  let exitStatus = SUCCESS_EXIT_STATUS;
  try {
    exitStatus = await main();
  } catch (error) {
    console.error(
      "Search backfill could not start. Check the database and EVE configuration.",
      error
    );
    exitStatus = FAILURE_EXIT_STATUS;
  } finally {
    exitStatus = await shutdownDatabase(exitStatus);
  }
  process.exitCode = exitStatus;
})();
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-console */
