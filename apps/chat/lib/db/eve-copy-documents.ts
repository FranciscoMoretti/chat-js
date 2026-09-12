import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "./client";
import {
  eveConversation,
  eveDocumentHead,
  eveDocumentRevision,
} from "./schema";

/** Internal copy preparation: IDs must come from the sanitized published transcript. */
export async function snapshotPublicEveCopyDocuments(
  conversationId: string,
  sessionId: string,
  resources: { documentIds: readonly string[]; revisionIds: readonly string[] }
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
    return heads.map((head) => {
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
  });
}
