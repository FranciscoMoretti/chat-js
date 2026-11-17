import { reconcileEveWorkspaceTurn } from "@/lib/eve/reconcile-workspace-turn";
import { EveWorkspaceBusyError, lockEveWorkspace } from "./eve-workspace-turns";
import { isNonEmptyString } from "@/lib/is-non-empty-string";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "./client";
import { eveConversation, eveDispatch, eveFileReference } from "./schema";
import { getEveMessageDisplayReceipts } from "./eve-dispatch";
import { readCompletedEveCopyTranscript } from "@/lib/eve/completed-copy-source";
import { parseEveCopySeed } from "@/lib/eve/copy-seed";

/** Capture current completed history and owned resources once, before native dispatch. */
export const initializeEveCurrentCopy = async (
  ownerId: string,
  conversationId: string
): Promise<void> => {
  await reconcileEveWorkspaceTurn(ownerId, conversationId);
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${ownerId}`}, 0))`
    );
    const [membership] = await tx
      .select({ workspaceId: eveConversation.workspaceId })
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.id, conversationId),
          eq(eveConversation.ownerId, ownerId)
        )
      );
    if (membership === undefined) {
      throw new Error("Copy conversation not found.");
    }
    // Provider registration holds this fence before checking conversation foreign keys.
    // Acquire it before the row lock so capture cannot deadlock native initialization.
    const workspace = await lockEveWorkspace(
      tx,
      ownerId,
      membership.workspaceId
    );
    const [target] = await tx
      .select()
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.id, conversationId),
          eq(eveConversation.ownerId, ownerId),
          eq(eveConversation.workspaceId, membership.workspaceId)
        )
      )
      .for("update");
    if (
      !isNonEmptyString(target?.parentConversationId) ||
      !["creating", "uncertain"].includes(target.state)
    ) {
      throw new Error("Copy conversation not found.");
    }
    if (target.initialSeed !== null) {
      return;
    }
    if (workspace.activeOperationId !== null) {
      throw new EveWorkspaceBusyError();
    }
    const [source] = await tx
      .select()
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.id, target.parentConversationId),
          eq(eveConversation.ownerId, ownerId),
          eq(eveConversation.state, "bound")
        )
      )
      .for("share");
    if (
      !isNonEmptyString(source?.sessionId) ||
      source.workspaceId !== target.workspaceId
    ) {
      throw new Error("Source conversation not found.");
    }
    const dispatches = await tx
      .select()
      .from(eveDispatch)
      .where(
        and(
          eq(eveDispatch.conversationId, source.id),
          eq(eveDispatch.ownerId, ownerId)
        )
      );
    const receipts = await getEveMessageDisplayReceipts(
      ownerId,
      source.sessionId,
      tx
    );
    const projection = await readCompletedEveCopyTranscript(
      ownerId,
      source.sessionId,
      dispatches,
      receipts,
      target.forkMessageId ?? undefined
    );
    const files = await tx
      .select()
      .from(eveFileReference)
      .where(
        and(
          eq(eveFileReference.conversationId, source.id),
          eq(eveFileReference.ownerId, ownerId),
          inArray(eveFileReference.key, projection.resources.fileKeys)
        )
      );
    if (files.length) {
      await tx
        .insert(eveFileReference)
        .values(files.map((file) => ({ ...file, conversationId })))
        .onConflictDoNothing();
    }
    await tx
      .update(eveConversation)
      .set({ initialSeed: parseEveCopySeed(projection.seed) })
      .where(eq(eveConversation.id, conversationId));
  });
};

/** Only accepted server reservations can supply trusted branch history. */
export const resolveEveBranchHistory = async (
  ownerId: string,
  reservationId: string
) => {
  const [row] = await db
    .select()
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.id, reservationId),
        eq(eveConversation.ownerId, ownerId)
      )
    );
  if (row === undefined || !["creating", "uncertain"].includes(row.state)) {
    throw new Error("Branch initialization is unavailable.");
  }
  if (row.parentConversationId === null) {
    return null;
  }
  if (row.initialSeed === null) {
    throw new Error("Branch history was not captured.");
  }
  return parseEveCopySeed(row.initialSeed);
};
