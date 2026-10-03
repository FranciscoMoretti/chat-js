/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../db/eve-queries" dependency within this package instead of introducing an alias or barrel API.
 */
import type { MessageStreamEvent } from "eve/client";

import { recordEveConversationActivity } from "../db/eve-queries";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable jsdoc/require-param, typescript/prefer-readonly-parameter-types  --
 * import/no-named-export (#527): Preserve the named ingestEveActivity API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): ingestEveActivity remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * jsdoc/require-param (#534): ingestEveActivity's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * oxc/no-async-await (#540): ingestEveActivity sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): ingestEveActivity accepts event: MessageStreamEvent; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/** Project only activity metadata from Eve; replay must never move a chat backwards. */
export const ingestEveActivity = async (
  ownerId: string,
  sessionId: string,
  event: MessageStreamEvent
): Promise<void> => {
  if (event.type === "message.received" || event.type === "message.completed") {
    await recordEveConversationActivity(
      ownerId,
      sessionId,
      new Date(event.meta.at)
    );
  }
};
/* oxlint-enable jsdoc/require-param, typescript/prefer-readonly-parameter-types */
