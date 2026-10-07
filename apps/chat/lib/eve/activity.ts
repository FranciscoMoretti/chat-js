import type { MessageStreamEvent } from "eve/client";

import { recordEveConversationActivity } from "@/lib/db/eve-queries";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ingestEveActivity); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve ingestEveActivity's awaited sequencing and rejected-Promise behavior. */
/** Project only activity metadata from Eve; replay must never move a chat backwards.
 * @param {string} ownerId Owner used to scope the monotonic activity update.
 * @param {string} sessionId Native session whose conversation receives activity metadata.
 * @param {MessageStreamEvent} event Native event supplying a received/completed message timestamp.
 * @returns {Promise<void>} Resolves after the authorized activity update, or without a write for unrelated event kinds.
 */
export const ingestEveActivity = async (
  ownerId: string,
  sessionId: string,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Native MessageStreamEvent includes recursive history/subagent data; mapped readonly instantiation exceeds compiler limits, so preserve the native union contract on this parameter.
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
