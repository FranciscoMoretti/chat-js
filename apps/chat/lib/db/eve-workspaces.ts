import { and, eq, sql } from "drizzle-orm";
import { db } from "./client";
import { eveConversation, eveWorkspace } from "./schema";

/** Caller holds the owner-family fence through conversation reservation. */
export const reserveConversationWorkspace = async (
  tx: Pick<typeof db, "execute" | "select" | "insert">,
  ownerId: string,
  sourceConversationId?: string
): Promise<string> => {
  if (sourceConversationId !== undefined) {
    const [source] = await tx
      .select()
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.id, sourceConversationId),
          eq(eveConversation.ownerId, ownerId),
          eq(eveConversation.state, "bound")
        )
      );
    if (source === undefined) {
      throw new Error("Workspace source conversation is unavailable.");
    }
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`chatjs-workspace:${source.workspaceId}`}, 0))`
    );
    const [workspace] = await tx
      .select()
      .from(eveWorkspace)
      .where(
        and(
          eq(eveWorkspace.id, source.workspaceId),
          eq(eveWorkspace.ownerId, ownerId)
        )
      );
    if (workspace?.state !== "active") {
      throw new Error("Workspace is unavailable.");
    }
    return workspace.id;
  }
  const [workspace] = await tx
    .insert(eveWorkspace)
    .values({ ownerId })
    .returning();
  if (workspace === undefined) {
    throw new Error("Workspace reservation failed.");
  }
  return workspace.id;
};

/** Owner-filtered lookup; workspace identifiers are never authorization. */
export const readOwnedWorkspace = async (
  ownerId: string,
  workspaceId: string
) => {
  const [workspace] = await db
    .select({ id: eveWorkspace.id, state: eveWorkspace.state })
    .from(eveWorkspace)
    .where(
      and(eq(eveWorkspace.id, workspaceId), eq(eveWorkspace.ownerId, ownerId))
    );
  return workspace ?? null;
};
