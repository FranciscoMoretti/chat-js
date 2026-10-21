import { and, eq, inArray } from "drizzle-orm";
import { EveForkBoundaryError } from "@/lib/eve/fork-boundary-error";
import { db } from "./client";
import { eveConversation, eveFileReference } from "./schema";
import { EveWorkspaceBusyError } from "./eve-workspace-turns";

export const markEveCreationFailure = async (
  conversationId: string,
  error: unknown
): Promise<void> => {
  const rejected =
    error instanceof EveForkBoundaryError ||
    error instanceof EveWorkspaceBusyError;
  await db.transaction(async (tx) => {
    const changed = await tx
      .update(eveConversation)
      .set({
        state: rejected ? "deleted" : "uncertain",
      })
      .where(
        and(
          eq(eveConversation.id, conversationId),
          inArray(eveConversation.state, ["creating", "uncertain"])
        )
      )
      .returning({ id: eveConversation.id });
    if (rejected && changed.length > 0) {
      // These rejections have no native dispatch or allocation. Remove only
      // this reservation's references; workspace retention is independent.
      await tx
        .delete(eveFileReference)
        .where(eq(eveFileReference.conversationId, conversationId));
    }
  });
};
