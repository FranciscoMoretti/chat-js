/* oxlint-disable import/no-relative-parent-imports, sort-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../db/eve-search" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { Client } from "eve/client";

import { indexEveSearchText } from "../db/eve-search";
import { getEveConnectionOptions } from "./connection-options";
import { eveEventSearchText } from "./search-text";
import type { EveSearchText } from "./search-text";
/* oxlint-enable import/no-relative-parent-imports, sort-imports */

/* oxlint-disable import/no-named-export, import/prefer-default-export, jsdoc/require-param, no-magic-numbers, oxc/no-async-await --
 * import/no-named-export (#527): Preserve the named backfillEveSearchConversation API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): backfillEveSearchConversation remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * jsdoc/require-param (#534): backfillEveSearchConversation's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * no-magic-numbers (#517): backfillEveSearchConversation uses 30_000, 100 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): backfillEveSearchConversation sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
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
/* oxlint-enable import/no-named-export, import/prefer-default-export, jsdoc/require-param, no-magic-numbers, oxc/no-async-await */
