import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "./client";
import { eveDeletionScope } from "./eve-deletion-scope";
import { eveConversation, eveWorkspace } from "./schema";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const lock = async (
  tx: Readonly<Pick<Transaction, "execute">>,
  workspaceId: string
): Promise<void> => {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`chatjs-workspace:${workspaceId}`}, 0))`
  );
};

/** Retire application workspace metadata only after all conversations have retired. */
export const cleanupWorkspaceIfUnused = async (
  ownerId: string,
  workspaceId: string,
  explicit = false
): Promise<void> => {
  await db.transaction(async (tx) => {
    await lock(tx, workspaceId);
    const [workspace] = await tx
      .select()
      .from(eveWorkspace)
      .where(
        and(eq(eveWorkspace.id, workspaceId), eq(eveWorkspace.ownerId, ownerId))
      );
    if (workspace === undefined) {
      throw new Error("Workspace ownership is unavailable.");
    }
    if (workspace.state === "deleted") {
      return;
    }
    const members = await tx
      .select({ id: eveConversation.id })
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.workspaceId, workspaceId),
          ne(eveConversation.state, "deleted"),
          ne(eveConversation.state, "deleting")
        )
      )
      .limit(1);
    if (members.length > 0) {
      if (explicit) {
        throw new Error(
          "Delete attached conversations before deleting this workspace."
        );
      }
      return;
    }
    if (workspace.activeOperationId !== null) {
      throw new Error("Workspace turn retirement is incomplete.");
    }
    await tx
      .update(eveWorkspace)
      .set({ state: "deleted" })
      .where(eq(eveWorkspace.id, workspaceId));
  });
};

/** Includes never-dispatched members, which have no native session to trigger resource cleanup. */
export const cleanupRetiredEveWorkspaces = async (
  ownerId: string,
  routeId: string
): Promise<void> => {
  const members = await db
    .select({ workspaceId: eveConversation.workspaceId })
    .from(eveConversation)
    .where(
      and(
        eveDeletionScope(ownerId, routeId),
        inArray(eveConversation.state, ["deleted", "deleting"])
      )
    );
  for (const workspaceId of new Set(
    members.map((member) => member.workspaceId)
  )) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Each workspace cleanup checks remaining conversations and active application operations.
    await cleanupWorkspaceIfUnused(ownerId, workspaceId);
  }
};

/** Finalization retains ownership and pending-operation checks for application workspaces. */
export const checkDeletedWorkspaceMemberships = async (
  ownerId: string,
  branchIds: readonly string[],
  transaction?: Readonly<Pick<Transaction, "execute" | "select">>
): Promise<void> => {
  const check = async (
    tx: Readonly<Pick<Transaction, "execute" | "select">>
  ): Promise<void> => {
    const conversations = await tx
      .select()
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.ownerId, ownerId),
          inArray(eveConversation.id, [...branchIds])
        )
      );
    if (
      conversations.length !== new Set(branchIds).size ||
      conversations.some(
        (member) => !["deleting", "deleted"].includes(member.state)
      )
    ) {
      throw new Error("Workspace membership deletion is not authorized.");
    }
    for (const workspaceId of [
      ...new Set(conversations.map((member) => member.workspaceId)),
    ].toSorted()) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Consistent workspace order serializes workspace finalization.
      await lock(tx, workspaceId);
      // oxlint-disable-next-line eslint/no-await-in-loop -- Read cleanup eligibility under the same workspace lock.
      const live = await tx
        .select({ id: eveConversation.id })
        .from(eveConversation)
        .where(
          and(
            eq(eveConversation.workspaceId, workspaceId),
            ne(eveConversation.state, "deleted"),
            ne(eveConversation.state, "deleting")
          )
        )
        .limit(1);
      if (live.length > 0) {
        continue;
      }
      // oxlint-disable-next-line eslint/no-await-in-loop -- Last-member cleanup must have committed its workspace tombstone.
      const [workspace] = await tx
        .select()
        .from(eveWorkspace)
        .where(
          and(
            eq(eveWorkspace.id, workspaceId),
            eq(eveWorkspace.ownerId, ownerId)
          )
        );
      if (workspace?.state !== "deleted") {
        throw new Error("Workspace cleanup is incomplete.");
      }
    }
  };
  await (transaction ? check(transaction) : db.transaction(check));
};
