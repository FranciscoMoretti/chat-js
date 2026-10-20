import { and, eq, inArray } from "drizzle-orm";
import { EveForkBoundaryError } from "@/lib/eve/fork-boundary-error";
import { db } from "./client";
import { eveConversation, eveFileReference } from "./schema";

export const markEveCreationFailure = async (
  conversationId: string,
  error: unknown
): Promise<void> => {
  await db.transaction(async (tx) => {
    const changed = await tx
      .update(eveConversation)
      .set({
        state: error instanceof EveForkBoundaryError ? "deleted" : "uncertain",
      })
      .where(
        and(
          eq(eveConversation.id, conversationId),
          inArray(eveConversation.state, ["creating", "uncertain"])
        )
      )
      .returning({ id: eveConversation.id });
    if (error instanceof EveForkBoundaryError && changed.length > 0) {
      // A rejected boundary has no native dispatch or allocation. Remove only
      // this reservation's references; workspace retention is independent.
      await tx
        .delete(eveFileReference)
        .where(eq(eveFileReference.conversationId, conversationId));
    }
  });
};
