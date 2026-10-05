import { Client } from "eve/client";

import { indexEveSearchText } from "@/lib/db/eve-search";

import { getEveConnectionOptions } from "./connection-options";
import { eveEventSearchText } from "./search-text";
import type { EveSearchText } from "./search-text";

/* oxlint-disable jsdoc/require-param, no-magic-numbers --
 * jsdoc/require-param (#534): backfillEveSearchConversation's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * no-magic-numbers (#517): backfillEveSearchConversation uses 30_000, 100 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
/** Recover from durable events, including text omitted from the bounded live retry buffer. */
export const backfillEveSearchConversation = async (
  ownerId: string,
  conversationId: string,
  sessionId: string
): Promise<void> => {
  const client = new Client(getEveConnectionOptions(ownerId));
  const snapshot = await client.sessions
    .attach(sessionId)
    .snapshot({ signal: AbortSignal.timeout(30_000) });
  let batch: EveSearchText[] = [];
  for (const event of snapshot.events) {
    for (const entry of eveEventSearchText(event)) {
      batch.push(entry);
      if (batch.length === 100) {
        // oxlint-disable-next-line eslint/no-await-in-loop -- Bound each database write while consuming the snapshot.
        await indexEveSearchText(ownerId, conversationId, batch);
        batch = [];
      }
    }
  }
  await indexEveSearchText(ownerId, conversationId, batch);
};
/* oxlint-enable jsdoc/require-param, no-magic-numbers */
