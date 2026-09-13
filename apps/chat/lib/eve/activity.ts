import type { MessageStreamEvent } from "eve/client";

import { recordEveConversationActivity } from "../db/eve-queries";

/** Project only activity metadata from Eve; replay must never move a chat backwards. */
export const ingestEveActivity = async (
  ownerId: string,
  sessionId: string,
  event: MessageStreamEvent
) => {
  if (event.type === "message.received" || event.type === "message.completed") {
    await recordEveConversationActivity(
      ownerId,
      sessionId,
      new Date(event.meta.at)
    );
  }
};
