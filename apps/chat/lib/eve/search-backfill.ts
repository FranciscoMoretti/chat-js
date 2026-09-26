import { Client } from "eve/client";

import { indexEveSearchText } from "../db/eve-search";
import { getEveConnectionOptions } from "./connection-options";
import { eveEventSearchText } from "./search-text";
import type { EveSearchText } from "./search-text";

/** Recover from durable events, including text omitted from the bounded live retry buffer. */
export const backfillEveSearchConversation = async (
  ownerId: string,
  conversationId: string,
  sessionId: string
) => {
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
