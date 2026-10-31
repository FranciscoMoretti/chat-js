import type { SessionEvent } from "eve/client";
import { recordEveConversationActivity } from "@/lib/db/eve-queries";

/** Hook commit time, never progress arrival time, determines conversation activity. */
export const ingestEveActivity = async (
  ownerId: string,
  sessionId: string,
  event: Readonly<Pick<SessionEvent, "type">>,
  at: Date
): Promise<void> => {
  if (event.type === "delivery.consumed" || event.type === "turn.settled") {
    await recordEveConversationActivity(ownerId, sessionId, at);
  }
};
