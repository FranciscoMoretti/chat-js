import { and, eq, inArray, sql } from "drizzle-orm";
import type { EveCopyBoundary } from "../eve/copy-boundaries";
import { db } from "./client";
import {
  eveConversation,
  eveDocumentCheckpoint,
  eveDocumentCheckpointEntry,
  eveDocumentHead,
  eveDocumentRevision,
  eveImportedDocumentCheckpoint,
  eveImportedDocumentCheckpointEntry,
} from "./schema";

/** Internal copy preparation: IDs must come from the sanitized published transcript. */
export async function snapshotPublicEveCopyDocuments(
  conversationId: string,
  sessionId: string,
  resources: { documentIds: readonly string[]; revisionIds: readonly string[] },
  boundaries: readonly EveCopyBoundary[]
) {
  const [identity] = await db
    .select({ ownerId: eveConversation.ownerId })
    .from(eveConversation)
    .where(eq(eveConversation.id, conversationId));
  if (!identity) {
    throw new Error("Shared conversation is unavailable.");
  }
  return await db.transaction(async (tx) => {
    // Same order as document writes/deletion; visibility updates serialize on the row.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${identity.ownerId}`}, 0))`
    );
    const [source] = await tx
      .select({ id: eveConversation.id })
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.id, conversationId),
          eq(eveConversation.ownerId, identity.ownerId),
          eq(eveConversation.sessionId, sessionId),
          eq(eveConversation.state, "bound"),
          eq(eveConversation.visibility, "public")
        )
      )
      .for("share");
    if (!source) {
      throw new Error("Shared conversation is unavailable.");
    }
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-document:${conversationId}`}, 0))`
    );
    const documentIds = [
      ...new Set(resources.documentIds.map((id) => id.toLowerCase())),
    ].sort();
    const heads = documentIds.length
      ? await tx
          .select({
            documentId: eveDocumentHead.documentId,
            revisionId: eveDocumentHead.revisionId,
          })
          .from(eveDocumentHead)
          .where(
            and(
              eq(eveDocumentHead.conversationId, conversationId),
              eq(eveDocumentHead.ownerId, identity.ownerId),
              inArray(eveDocumentHead.documentId, documentIds)
            )
          )
          .orderBy(eveDocumentHead.documentId)
      : [];
    if (heads.length !== documentIds.length) {
      throw new Error("A published document is no longer accessible.");
    }
    const revisions = heads.length
      ? await tx
          .select({
            id: eveDocumentRevision.id,
            documentId: eveDocumentRevision.documentId,
            parentRevisionId: eveDocumentRevision.parentRevisionId,
            title: eveDocumentRevision.title,
            content: eveDocumentRevision.content,
            kind: eveDocumentRevision.kind,
            createdAt: eveDocumentRevision.createdAt,
          })
          .from(eveDocumentRevision)
          .where(
            inArray(
              eveDocumentRevision.id,
              sql`(
      with recursive ancestry as (
        select "id", "parentRevisionId" from "EveDocumentRevision"
        where ${inArray(
          eveDocumentRevision.id,
          heads.map((head) => head.revisionId)
        )}
          and "ownerId" = ${identity.ownerId}
        union
        select revision."id", revision."parentRevisionId" from "EveDocumentRevision" revision
          join ancestry on revision."id" = ancestry."parentRevisionId"
          where revision."ownerId" = ${identity.ownerId}
      ) select "id" from ancestry
    )`
            )
          )
      : [];
    const byId = new Map(revisions.map((revision) => [revision.id, revision]));
    for (const id of resources.revisionIds) {
      if (!byId.has(id.toLowerCase())) {
        throw new Error(
          "A published revision is outside the accessible document history."
        );
      }
    }
    const documents = heads.map((head) => {
      const history: typeof revisions = [];
      const seen = new Set<string>();
      let id: string | null = head.revisionId;
      while (id) {
        const revision = byId.get(id);
        if (
          !revision ||
          seen.has(id) ||
          revision.documentId !== head.documentId
        ) {
          throw new Error("Document copy ancestry is incomplete.");
        }
        seen.add(id);
        history.push(revision);
        id = revision.parentRevisionId;
      }
      return {
        documentId: head.documentId,
        headRevisionId: head.revisionId,
        revisions: history.reverse(),
      };
    });
    const checkpoints = await snapshotCopyCheckpoints(tx, {
      conversationId,
      ownerId: identity.ownerId,
      documentIds,
      boundaries,
      byId,
    });
    return { documents, checkpoints };
  });
}

async function snapshotCopyCheckpoints(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: {
    conversationId: string;
    ownerId: string;
    documentIds: string[];
    boundaries: readonly EveCopyBoundary[];
    byId: ReadonlyMap<string, { documentId: string }>;
  }
) {
  const { conversationId, ownerId, documentIds, boundaries, byId } = input;
  const checkpointHeaders = new Set<string>();
  const checkpointEntries = new Map<
    string,
    { documentId: string; revisionId: string }[]
  >();
  const turns = boundaries
    .filter((boundary) => boundary.sourceKind === "turn")
    .map((boundary) => boundary.sourceIndex);
  const imported = boundaries
    .filter((boundary) => boundary.sourceKind === "imported")
    .map((boundary) => boundary.sourceIndex);
  if (turns.length && documentIds.length) {
    const headers = await tx
      .select({ index: eveDocumentCheckpoint.turnIndex })
      .from(eveDocumentCheckpoint)
      .where(
        and(
          eq(eveDocumentCheckpoint.conversationId, conversationId),
          eq(eveDocumentCheckpoint.ownerId, ownerId),
          inArray(eveDocumentCheckpoint.turnIndex, turns)
        )
      );
    for (const header of headers) {
      checkpointHeaders.add(`turn:${header.index}`);
    }
    const entries = await tx
      .select()
      .from(eveDocumentCheckpointEntry)
      .where(
        and(
          eq(eveDocumentCheckpointEntry.conversationId, conversationId),
          eq(eveDocumentCheckpointEntry.ownerId, ownerId),
          inArray(eveDocumentCheckpointEntry.turnIndex, turns),
          inArray(eveDocumentCheckpointEntry.documentId, documentIds)
        )
      );
    for (const entry of entries) {
      const key = `turn:${entry.turnIndex}`;
      const values = checkpointEntries.get(key) ?? [];
      values.push({
        documentId: entry.documentId,
        revisionId: entry.revisionId,
      });
      checkpointEntries.set(key, values);
    }
  }
  if (imported.length && documentIds.length) {
    const headers = await tx
      .select({ index: eveImportedDocumentCheckpoint.messageIndex })
      .from(eveImportedDocumentCheckpoint)
      .where(
        and(
          eq(eveImportedDocumentCheckpoint.conversationId, conversationId),
          eq(eveImportedDocumentCheckpoint.ownerId, ownerId),
          inArray(eveImportedDocumentCheckpoint.messageIndex, imported)
        )
      );
    for (const header of headers) {
      checkpointHeaders.add(`imported:${header.index}`);
    }
    const entries = await tx
      .select()
      .from(eveImportedDocumentCheckpointEntry)
      .where(
        and(
          eq(eveImportedDocumentCheckpointEntry.conversationId, conversationId),
          eq(eveImportedDocumentCheckpointEntry.ownerId, ownerId),
          inArray(eveImportedDocumentCheckpointEntry.messageIndex, imported),
          inArray(eveImportedDocumentCheckpointEntry.documentId, documentIds)
        )
      );
    for (const entry of entries) {
      const key = `imported:${entry.messageIndex}`;
      const values = checkpointEntries.get(key) ?? [];
      values.push({
        documentId: entry.documentId,
        revisionId: entry.revisionId,
      });
      checkpointEntries.set(key, values);
    }
  }
  const checkpoints = boundaries.map((boundary) => {
    const key = `${boundary.sourceKind}:${boundary.sourceIndex}`;
    if (documentIds.length && !checkpointHeaders.has(key)) {
      throw new Error("Published document boundary is unavailable.");
    }
    const heads = checkpointEntries.get(key) ?? [];
    for (const head of heads) {
      if (byId.get(head.revisionId)?.documentId !== head.documentId) {
        throw new Error(
          "Published document boundary is outside accessible ancestry."
        );
      }
    }
    return {
      messageIndex: boundary.messageIndex,
      heads: heads.sort((a, b) => a.documentId.localeCompare(b.documentId)),
    };
  });

  return checkpoints;
}
