/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/schema"; "../lib/eve/search-backfill"; "../lib/eve/server" dependency within this package instead of introducing an alias or barrel API.
 */
import { and, asc, eq, gt } from "drizzle-orm";

import { assertEveConfigured } from "../lib/eve/server";
import { backfillEveSearchConversation } from "../lib/eve/search-backfill";
import { db } from "../lib/db/client";
import { eveConversation } from "../lib/db/schema";
/* oxlint-enable import/no-relative-parent-imports */

const DATABASE_SHUTDOWN_TIMEOUT_SECONDS = 5;
const MILLISECONDS_PER_SECOND = 1000;
const DATABASE_SHUTDOWN_TIMEOUT_MILLISECONDS =
  DATABASE_SHUTDOWN_TIMEOUT_SECONDS * MILLISECONDS_PER_SECOND;
const SHUTDOWN_TERMINATION_GRACE_MILLISECONDS = 250;
const SHUTDOWN_OUTPUT_FLUSH_TIMEOUT_MILLISECONDS = 250;
const BACKFILL_BATCH_SIZE = 50;
const FAILURE_EXIT_STATUS = 1;
const SUCCESS_EXIT_STATUS = 0;
const INITIAL_PROGRESS_COUNT = 0;
const BACKFILL_COUNT_INCREMENT = 1;
const LAST_BATCH_INDEX = -1;

type DatabaseShutdownOutcome =
  | { kind: "complete" }
  | { error: unknown; kind: "failure" };

const createDelay = (
  milliseconds: number
): { cancel: () => void; promise: Promise<boolean> } => {
  const delaySignal = Promise.withResolvers<boolean>();
  const timer = setTimeout(() => {
    delaySignal.resolve(true);
  }, milliseconds);
  return {
    cancel: () => {
      clearTimeout(timer);
      delaySignal.resolve(false);
    },
    promise: delaySignal.promise,
  };
};

/* oxlint-disable oxc/no-async-await -- Await keeps synchronous throws and rejected database shutdowns inside this catch. */
const endDatabaseClient = async (): Promise<DatabaseShutdownOutcome> => {
  try {
    await db.$client.end({ timeout: DATABASE_SHUTDOWN_TIMEOUT_SECONDS });
    return { kind: "complete" };
  } catch (error) {
    return { error, kind: "failure" };
  }
};
/* oxlint-enable oxc/no-async-await */

type BackfillConversation = Pick<
  typeof eveConversation.$inferSelect,
  "id" | "ownerId" | "sessionId"
>;

/* oxlint-disable oxc/no-async-await -- Awaited batch selection and transaction updates preserve query ordering and propagate database failures. */
const selectNextBatch = async (
  cursor: string | undefined
): Promise<BackfillConversation[]> => {
  const query = db
    .select({
      id: eveConversation.id,
      ownerId: eveConversation.ownerId,
      sessionId: eveConversation.sessionId,
    })
    .from(eveConversation);
  if (typeof cursor === "string" && cursor !== "") {
    return await query
      .where(
        and(eq(eveConversation.state, "bound"), gt(eveConversation.id, cursor))
      )
      .orderBy(asc(eveConversation.id))
      .limit(BACKFILL_BATCH_SIZE);
  }
  return await query
    .where(eq(eveConversation.state, "bound"))
    .orderBy(asc(eveConversation.id))
    .limit(BACKFILL_BATCH_SIZE);
};
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable eslint/no-await-in-loop -- Fetch each snapshot and index each conversation in order to bound database load and make retries predictable. */
/* oxlint-disable oxc/no-async-await -- Await each conversation update before advancing the cursor so failed records remain retryable. */
/* oxlint-disable init-declarations -- main initializes the optional cursor only after the first successful page, while counters start at named values. */
/* oxlint-disable no-console -- The backfill loop reports progress and per-record failures through this CLI's stdout/stderr. */
/* oxlint-disable max-statements -- main coordinates configuration, batch selection, per-record failures, progress, and the final exit status in their required order. */
const main = async (): Promise<number> => {
  assertEveConfigured();
  let cursor: string | undefined;
  let indexed = INITIAL_PROGRESS_COUNT;
  let failed = INITIAL_PROGRESS_COUNT;
  while (true) {
    const batch = await selectNextBatch(cursor);
    if (batch.length === INITIAL_PROGRESS_COUNT) {
      break;
    }
    for (const conversation of batch) {
      if (conversation.sessionId !== null && conversation.sessionId !== "") {
        try {
          await backfillEveSearchConversation(
            conversation.ownerId,
            conversation.id,
            conversation.sessionId
          );
          indexed += BACKFILL_COUNT_INCREMENT;
        } catch (error) {
          failed += BACKFILL_COUNT_INCREMENT;
          console.error(
            `Search backfill failed for conversation ${conversation.id}; rerun to retry.`,
            error
          );
        }
      }
    }
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading id from batch.at(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    cursor = batch.at(LAST_BATCH_INDEX)?.id;
    console.info(`Search backfill: ${indexed} indexed, ${failed} failed.`);
  }
  if (failed > INITIAL_PROGRESS_COUNT) {
    return FAILURE_EXIT_STATUS;
  }
  return SUCCESS_EXIT_STATUS;
};
/* oxlint-enable eslint/no-await-in-loop */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable init-declarations */
/* oxlint-enable max-statements */
/* oxlint-enable no-console */

/* oxlint-disable oxc/no-async-await -- Await both stream callbacks or the deadline before the caller forces process exit. */
const flushOutputBeforeForcedExit = async (): Promise<void> => {
  const stdoutFlushed = Promise.withResolvers<boolean>();
  const stderrFlushed = Promise.withResolvers<boolean>();
  process.stdout.write("", () => stdoutFlushed.resolve(true));
  process.stderr.write("", () => stderrFlushed.resolve(true));
  const flushDeadline = createDelay(SHUTDOWN_OUTPUT_FLUSH_TIMEOUT_MILLISECONDS);
  await Promise.race([
    Promise.all([stdoutFlushed.promise, stderrFlushed.promise]),
    flushDeadline.promise,
  ]);
  flushDeadline.cancel();
};
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable max-statements -- shutdownDatabase owns the timeout race, grace period, safe logging, forced exit, and normal cancellation sequence. */
/* oxlint-disable oxc/no-async-await -- Await the shutdown and grace deadlines in order so each timeout path retains its existing outcome. */
/* oxlint-disable no-console -- Report each database shutdown failure or timeout before returning the CLI status. */
const shutdownDatabase = async (exitStatus: number): Promise<number> => {
  const deadline = createDelay(DATABASE_SHUTDOWN_TIMEOUT_MILLISECONDS);
  const shutdown = endDatabaseClient();
  const firstOutcome = await Promise.race([shutdown, deadline.promise]);
  if (typeof firstOutcome === "boolean") {
    const terminationGrace = createDelay(
      SHUTDOWN_TERMINATION_GRACE_MILLISECONDS
    );
    const finalShutdownOutcome = await Promise.race([
      shutdown,
      terminationGrace.promise,
    ]);
    if (
      typeof finalShutdownOutcome === "object" &&
      finalShutdownOutcome.kind === "failure"
    ) {
      console.error(
        "Search backfill database shutdown failed.",
        finalShutdownOutcome.error
      );
    }
    console.error(
      "Search backfill database shutdown timed out; forcing process exit."
    );
    await flushOutputBeforeForcedExit();
    // oxlint-disable-next-line unicorn/no-process-exit -- postgres@3.4.9 end({ timeout }) can resolve after its deadline while a half-open peer keeps the socket active; this CLI must exit after a bounded output-flush window.
    process.exit(FAILURE_EXIT_STATUS);
  }
  deadline.cancel();
  if (firstOutcome.kind === "failure") {
    console.error(
      "Search backfill database shutdown failed.",
      firstOutcome.error
    );
    return FAILURE_EXIT_STATUS;
  }
  return exitStatus;
};
/* oxlint-enable no-console */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-statements */
/* oxlint-disable no-console -- This entrypoint emits startup errors through console.error and sets process.exitCode after shutdown completes. */
/* oxlint-disable oxc/no-async-await -- Await main and shutdownDatabase so the catch/finally sequence settles before setting process.exitCode. */
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
