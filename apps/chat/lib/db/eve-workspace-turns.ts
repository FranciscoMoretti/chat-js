import { alias } from "drizzle-orm/pg-core";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "./client";
import { eveConversation, eveDispatch, eveWorkspace } from "./schema";

export type WorkspaceTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

export class EveWorkspaceBusyError extends Error {
  public constructor() {
    super(
      "Another conversation is using this workspace, or its delivery is unresolved. Wait for it to finish or cancel its active turn."
    );
    this.name = "EveWorkspaceBusyError";
  }
}

/** Shared lock order: caller's family fence, workspace advisory lock, workspace row. */
export const lockEveWorkspace = async (
  tx: WorkspaceTransaction,
  ownerId: string,
  workspaceId: string
) => {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`chatjs-workspace:${workspaceId}`}, 0))`
  );
  const [workspace] = await tx
    .select()
    .from(eveWorkspace)
    .where(
      and(eq(eveWorkspace.id, workspaceId), eq(eveWorkspace.ownerId, ownerId))
    )
    .for("update");
  if (workspace === undefined || workspace.state !== "active") {
    throw new Error("Workspace is unavailable.");
  }
  return workspace;
};

/** Capture and mutation callers must check this while holding the shared workspace lock. */
export const assertEveWorkspaceIdle = async (
  tx: WorkspaceTransaction,
  ownerId: string,
  workspaceId: string
): Promise<void> => {
  const workspace = await lockEveWorkspace(tx, ownerId, workspaceId);
  if (workspace.activeOperationId !== null) {
    throw new EveWorkspaceBusyError();
  }
};

/** Call under the workspace lock before releasing or transferring an active reservation. */
export const hasUnresolvedWorkspaceSteer = async (
  tx: Pick<WorkspaceTransaction, "select">,
  ownerId: string,
  workspaceId: string
): Promise<boolean> => {
  const [pending] = await tx
    .select({ operationId: eveDispatch.operationId })
    .from(eveDispatch)
    .innerJoin(
      eveConversation,
      and(
        eq(eveConversation.id, eveDispatch.conversationId),
        eq(eveConversation.ownerId, eveDispatch.ownerId)
      )
    )
    .where(
      and(
        eq(eveConversation.workspaceId, workspaceId),
        eq(eveDispatch.ownerId, ownerId),
        eq(eveDispatch.kind, "send"),
        isNull(eveDispatch.sessionId),
        sql`${eveDispatch.intent}->>'turnPolicy' = 'steer'`
      )
    )
    .limit(1);
  return pending !== undefined;
};

/** Resolve active work only through owned conversation membership; IDs alone grant no access. */
export const readActiveEveWorkspaceOperation = async (
  ownerId: string,
  conversationId: string
) => {
  const activeConversation = alias(
    eveConversation,
    "active_workspace_conversation"
  );
  const [entry] = await db
    .select({
      workspaceId: eveWorkspace.id,
      operation: eveDispatch,
      deleting: activeConversation.state,
    })
    .from(eveConversation)
    .innerJoin(
      eveWorkspace,
      and(
        eq(eveWorkspace.id, eveConversation.workspaceId),
        eq(eveWorkspace.ownerId, eveConversation.ownerId)
      )
    )
    .innerJoin(
      eveDispatch,
      and(
        eq(eveDispatch.ownerId, eveWorkspace.ownerId),
        eq(eveDispatch.operationId, eveWorkspace.activeOperationId)
      )
    )
    .innerJoin(
      activeConversation,
      and(
        eq(activeConversation.id, eveDispatch.conversationId),
        eq(activeConversation.ownerId, eveWorkspace.ownerId),
        eq(activeConversation.workspaceId, eveWorkspace.id)
      )
    )
    .where(
      and(
        eq(eveConversation.id, conversationId),
        eq(eveConversation.ownerId, ownerId),
        eq(eveWorkspace.state, "active")
      )
    );
  return entry;
};

/** Only exact known operation evidence can clear the reservation; stale readers cannot clear a successor. */
export const releaseSettledEveWorkspaceOperation = async (
  ownerId: string,
  workspaceId: string,
  operationId: string
): Promise<void> => {
  await db.transaction(async (tx) => {
    const workspace = await lockEveWorkspace(tx, ownerId, workspaceId);
    if (
      workspace.activeOperationId !== operationId ||
      (await hasUnresolvedWorkspaceSteer(tx, ownerId, workspaceId))
    ) {
      return;
    }
    await tx
      .update(eveWorkspace)
      .set({ activeOperationId: null })
      .where(
        and(
          eq(eveWorkspace.id, workspaceId),
          eq(eveWorkspace.ownerId, ownerId),
          eq(eveWorkspace.activeOperationId, operationId)
        )
      );
  });
};
