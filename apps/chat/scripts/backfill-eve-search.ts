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
    if (!batch.length) {
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
  process.exit(failed ? 1 : 0);
};
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
