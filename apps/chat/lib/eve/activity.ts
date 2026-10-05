import type { MessageStreamEvent } from "eve/client";

import { recordEveConversationActivity } from "@/lib/db/eve-queries";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ingestEveActivity); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve ingestEveActivity's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable jsdoc/require-param, typescript/prefer-readonly-parameter-types --
 * jsdoc/require-param (#534): ingestEveActivity's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable jsdoc/require-param, typescript/prefer-readonly-parameter-types */
