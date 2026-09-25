/* oxlint-disable eslint/no-await-in-loop -- Sequential snapshots bound worker load and make retries predictable. */
import { asc, eq, gt, and } from "drizzle-orm";
import { Client } from "eve/client";

import { db } from "../lib/db/client";
import { indexEveSearchText } from "../lib/db/eve-search";
import { eveConversation } from "../lib/db/schema";
import { getEveConnectionOptions } from "../lib/eve/connection-options";
import { eveEventSearchText } from "../lib/eve/search-text";
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
        const client = new Client(
          getEveConnectionOptions(conversation.ownerId)
        );
        const snapshot = await client.sessions
          .attach(conversation.sessionId)
          .snapshot({ signal: AbortSignal.timeout(30_000) });
        await indexEveSearchText(
          conversation.ownerId,
          conversation.id,
          snapshot.events.flatMap(eveEventSearchText)
        );
        indexed += 1;
      } catch {
        failed += 1;
        console.error(
          `Search backfill failed for conversation ${conversation.id}; rerun to retry.`
        );
      }
    }
    cursor = batch.at(-1)?.id;
    console.info(`Search backfill: ${indexed} indexed, ${failed} failed.`);
  }
  process.exit(failed ? 1 : 0);
};
// oxlint-disable-next-line promise/prefer-await-to-then -- This tsx CLI runs as CommonJS, which cannot use top-level await.
main().catch(() => {
  console.error(
    "Search backfill could not start. Check the database and EVE configuration."
  );
  process.exit(1);
});
