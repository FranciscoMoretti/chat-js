import { Client } from "eve/client";

import { indexEveSearchText } from "@/lib/db/eve-search";

import { getEveConnectionOptions } from "./connection-options";
import type { EveSearchText } from "./search-text";
import { eveEventSearchText } from "./search-text";

const SEARCH_SNAPSHOT_TIMEOUT_MS = 30_000;
const SEARCH_INDEX_BATCH_SIZE = 100;

/**
 * Recover from durable events, including text omitted from the bounded live retry buffer.
 * @param {string} ownerId Owner whose EVE credentials and search index receive the recovered text.
 * @param {string} conversationId Conversation receiving idempotent event and seed search entries.
 * @param {string} sessionId Durable EVE session whose snapshot supplies the history.
 * @returns {Promise<void>} Resolves after every batch is indexed; snapshot and index failures reject for a later retry.
 */
export const backfillEveSearchConversation = async (
  ownerId: string,
  conversationId: string,
  sessionId: string
): Promise<void> => {
  const client = new Client(getEveConnectionOptions(ownerId));
  const snapshot = await client.sessions
    .attach(sessionId)
    .snapshot({ signal: AbortSignal.timeout(SEARCH_SNAPSHOT_TIMEOUT_MS) });
  let batch: EveSearchText[] = [];
  for (const event of snapshot.events) {
    for (const entry of eveEventSearchText(event)) {
      batch.push(entry);
      if (batch.length === SEARCH_INDEX_BATCH_SIZE) {
        // oxlint-disable-next-line eslint/no-await-in-loop -- Flush SEARCH_INDEX_BATCH_SIZE text entries before continuing the snapshot so a failed batch stops later writes and buffered indexing work stays bounded.
        await indexEveSearchText(ownerId, conversationId, batch);
        batch = [];
      }
    }
  }
  await indexEveSearchText(ownerId, conversationId, batch);
};
