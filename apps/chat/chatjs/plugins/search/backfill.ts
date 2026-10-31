import { and, asc, eq, gt } from "drizzle-orm";

import { assertEveConfigured } from "@/lib/eve/server";
import { backfillEveSearchConversation } from "@/chatjs/plugins/search/search-backfill";
import { db } from "@/lib/db/client";
import { eveConversation } from "@/lib/db/schema";

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
const INITIAL_BACKFILL_CURSOR = "";

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

const endDatabaseClient = async (): Promise<DatabaseShutdownOutcome> => {
  try {
    await db.$client.end({ timeout: DATABASE_SHUTDOWN_TIMEOUT_SECONDS });
    return { kind: "complete" };
  } catch (error) {
    return { error, kind: "failure" };
  }
};

type BackfillConversation = Pick<
  typeof eveConversation.$inferSelect,
  "id" | "ownerId" | "sessionId"
>;

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

const main = async (): Promise<number> => {
  assertEveConfigured();
  let cursor = INITIAL_BACKFILL_CURSOR;
  let indexed = INITIAL_PROGRESS_COUNT;
  let failed = INITIAL_PROGRESS_COUNT;
  while (true) {
    // oxlint-disable-next-line no-await-in-loop -- The next query uses the cursor advanced only after the previous batch has finished indexing.
    const batch = await selectNextBatch(cursor);
    if (batch.length === INITIAL_PROGRESS_COUNT) {
      break;
    }
    for (const conversation of batch) {
      if (conversation.sessionId !== null && conversation.sessionId !== "") {
        try {
          // oxlint-disable-next-line no-await-in-loop -- Load and index one conversation snapshot at a time to bound memory and database work.
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
    cursor = batch[batch.length + LAST_BATCH_INDEX].id;
    console.info(`Search backfill: ${indexed} indexed, ${failed} failed.`);
  }
  if (failed > INITIAL_PROGRESS_COUNT) {
    return FAILURE_EXIT_STATUS;
  }
  return SUCCESS_EXIT_STATUS;
};

const flushOutputBeforeForcedExit = async (): Promise<void> => {
  const stdoutFlushed = Promise.withResolvers<boolean>();
  const stderrFlushed = Promise.withResolvers<boolean>();
  process.stdout.write("", () => {
    stdoutFlushed.resolve(true);
  });
  process.stderr.write("", () => {
    stderrFlushed.resolve(true);
  });
  const flushDeadline = createDelay(SHUTDOWN_OUTPUT_FLUSH_TIMEOUT_MILLISECONDS);
  await Promise.race([
    Promise.all([stdoutFlushed.promise, stderrFlushed.promise]),
    flushDeadline.promise,
  ]);
  flushDeadline.cancel();
};

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
