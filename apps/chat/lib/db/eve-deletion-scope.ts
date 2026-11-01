import { and, eq, or } from "drizzle-orm";
import { eveConversation } from "./schema";

/** An exact conversation selects one branch; a logical chat selects its whole group. */
export const eveDeletionScope = (ownerId: string, id: string) =>
  and(
    eq(eveConversation.ownerId, ownerId),
    or(eq(eveConversation.id, id), eq(eveConversation.chatId, id))
  );
