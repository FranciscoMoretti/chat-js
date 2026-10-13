import type { MessageStreamEvent } from "eve/client";

import { recordEveConversationActivity } from "@/lib/db/eve-queries";

/** Project only activity metadata from Eve; replay must never move a chat backwards.
 * @param {string} ownerId Owner used to scope the monotonic activity update.
 * @param {string} sessionId Native session whose conversation receives activity metadata.
 * @param {MessageStreamEvent} event Native event supplying a received/completed message timestamp.
 * @returns {Promise<void>} Resolves after the authorized activity update, or without a write for unrelated event kinds.
 */
export const ingestEveActivity = async (
  ownerId: string,
  sessionId: string,

  event: Readonly<Pick<MessageStreamEvent, "type" | "meta">>
): Promise<void> => {
  if (event.type === "message.received" || event.type === "message.completed") {
    await recordEveConversationActivity(
      ownerId,
      sessionId,
      new Date(event.meta.at)
    );
  }
};
