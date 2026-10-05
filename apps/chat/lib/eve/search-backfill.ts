import { Client } from "eve/client";

import { indexEveSearchText } from "@/lib/db/eve-search";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { getEveConnectionOptions } from "./connection-options";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { EveSearchText } from "./search-text";
/* oxlint-enable sort-imports */
import { eveEventSearchText } from "./search-text";

const SEARCH_SNAPSHOT_TIMEOUT_MS = 30_000;
const SEARCH_INDEX_BATCH_SIZE = 100;

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (backfillEveSearchConversation); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve backfillEveSearchConversation's awaited sequencing and rejected-Promise behavior. */
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
        // oxlint-disable-next-line eslint/no-await-in-loop -- Bound each database write while consuming the snapshot.
        await indexEveSearchText(ownerId, conversationId, batch);
        batch = [];
      }
    }
  }
  await indexEveSearchText(ownerId, conversationId, batch);
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
