import { reconcileEveWorkspaceTurn } from "@/lib/eve/reconcile-workspace-turn";
import { EveWorkspaceBusyError, lockEveWorkspace } from "./eve-workspace-turns";
import { getEveDocumentHistory } from "./eve-documents";
import { eveCopyResources } from "@/lib/eve/copy-transcript";
import { isNonEmptyString } from "@/lib/is-non-empty-string";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "./client";
import {
  eveConversation,
  eveDispatch,
  eveDocumentHead,
  eveDocumentRevision,
  eveFileReference,
} from "./schema";
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
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-document:${source.id}`}, 0))`
    );
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
    const heads = await tx
      .select()
      .from(eveDocumentHead)
      .where(
        and(
          eq(eveDocumentHead.conversationId, source.id),
          eq(eveDocumentHead.ownerId, ownerId)
        )
      );
    const selectedHeads: (typeof eveDocumentHead.$inferInsert)[] = [];
    const selectedFileKeys = new Set(projection.resources.fileKeys);
    for (const head of heads) {
      if (
        target.forkMessageId !== null &&
        !projection.resources.documentIds.includes(head.documentId)
      ) {
        continue;
      }
      // oxlint-disable-next-line eslint/no-await-in-loop -- Capture each document's authorized ancestry while its source document fence is held.
      const history = await getEveDocumentHistory(
        ownerId,
        source.id,
        head.documentId,
        tx
      );
      const selected =
        target.forkMessageId === null
          ? history.at(-1)
          : history.findLast((revision) =>
              projection.resources.revisionIds.includes(revision.id)
            );
      if (selected === undefined) {
        throw new Error("Selected document revision is unavailable.");
      }
      selectedHeads.push({ ...head, conversationId, revisionId: selected.id });
      const ancestry = history.slice(
        0,
        history.findIndex((revision) => revision.id === selected.id) + 1
      );
      // oxlint-disable-next-line eslint/no-await-in-loop -- Retain files only from the revisions this captured head authorizes.
      const revisions = await tx
        .select()
        .from(eveDocumentRevision)
        .where(
          and(
            eq(eveDocumentRevision.ownerId, ownerId),
            eq(eveDocumentRevision.documentId, head.documentId),
            inArray(
              eveDocumentRevision.id,
              ancestry.map((revision) => revision.id)
            )
          )
        );
      for (const revision of revisions) {
        for (const key of eveCopyResources(revision).fileKeys) {
          selectedFileKeys.add(key);
        }
      }
    }
    if (selectedHeads.length) {
      await tx.insert(eveDocumentHead).values(selectedHeads);
    }
    const files = await tx
      .select()
      .from(eveFileReference)
      .where(
        and(
          eq(eveFileReference.conversationId, source.id),
          eq(eveFileReference.ownerId, ownerId),
          inArray(eveFileReference.key, [...selectedFileKeys])
        )
      );
    if (files.length) {
      await tx
        .insert(eveFileReference)
        .values(files.map((file) => ({ ...file, conversationId })))
        .onConflictDoNothing();
    }
    const { resolveWorkspaceSeedAttachments } =
      await import("@/lib/eve/workspace-attachments");
    await tx
      .update(eveConversation)
      .set({
        initialSeed: await resolveWorkspaceSeedAttachments({
          ownerId,
          workspaceId: target.workspaceId,
          seed: parseEveCopySeed({
            ...projection.seed,
            attachments: "channel",
          }),
        }),
      })
      .where(eq(eveConversation.id, conversationId));
  });
};

/** Only accepted server reservations can supply trusted transcript seeds. */
export const resolveEveCurrentCopySeed = async (
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
  if (
    row === undefined ||
    row.initialSeed === null ||
    !["creating", "uncertain"].includes(row.state)
  ) {
    throw new Error("Copy initialization is unavailable.");
  }
  return parseEveCopySeed(row.initialSeed);
};
