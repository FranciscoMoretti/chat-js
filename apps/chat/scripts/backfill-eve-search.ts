/* oxlint-disable eslint/no-await-in-loop -- Sequential snapshots bound worker load and make retries predictable. */
import { asc, eq, gt, and } from "drizzle-orm";

import { db } from "../lib/db/client";
import { eveConversation } from "../lib/db/schema";
import { backfillEveSearchConversation } from "../lib/eve/search-backfill";
import { assertEveConfigured } from "../lib/eve/server";

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
