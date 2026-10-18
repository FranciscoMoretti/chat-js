import { and, eq, inArray, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import { db } from "./client";
import {
  eveConversation,
  eveDocumentHead,
  eveDocumentRevision,
} from "./schema";

type CaptureTransaction = Readonly<
  Pick<typeof db, "select"> & { execute: (query: SQL) => PromiseLike<unknown> }
>;

const FIRST_ROW_INDEX = 0;

/** Capture current public document heads and their revision ancestry under source locks. */
export const snapshotPublicEveCopyDocuments = async (
  conversationId: string,
  sessionId: string,
  resources: {
    readonly documentIds: readonly string[];
    readonly revisionIds: readonly string[];
  },
  captureTransaction?: CaptureTransaction
): Promise<{
  documents: {
    documentId: string;
    headRevisionId: string;
    revisions: Pick<
      typeof eveDocumentRevision.$inferSelect,
      | "content"
      | "createdAt"
      | "documentId"
      | "fileIds"
      | "id"
      | "kind"
      | "parentRevisionId"
      | "title"
    >[];
  }[];
}> => {
  const identityRows = await (captureTransaction ?? db)
    .select({ ownerId: eveConversation.ownerId })
    .from(eveConversation)
    .where(eq(eveConversation.id, conversationId));
  const identity = identityRows.at(FIRST_ROW_INDEX);
  if (!identity) {
    throw new Error("Shared conversation is unavailable.");
  }
  const capture = async (tx: CaptureTransaction) => {
    // Same order as document writes/deletion; visibility updates serialize on the row.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${identity.ownerId}`}, 0))`
    );
    const sourceRows = await tx
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
    const source = sourceRows.at(FIRST_ROW_INDEX);
    if (!source) {
      throw new Error("Shared conversation is unavailable.");
    }
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-document:${conversationId}`}, 0))`
    );
    const documentIds = [
      ...new Set(resources.documentIds.map((id) => id.toLowerCase())),
    ].toSorted();
    const heads =
      documentIds.length > 0
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
    const revisions =
      heads.length > 0
        ? await tx
            .select({
              content: eveDocumentRevision.content,
              createdAt: eveDocumentRevision.createdAt,
              documentId: eveDocumentRevision.documentId,
              fileIds: eveDocumentRevision.fileIds,
              id: eveDocumentRevision.id,
              kind: eveDocumentRevision.kind,
              parentRevisionId: eveDocumentRevision.parentRevisionId,
              title: eveDocumentRevision.title,
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
    const byId = new Map(
      revisions.map(
        (revision: ReadonlyNativeSurface<(typeof revisions)[number]>) => [
          revision.id,
          revision,
        ]
      )
    );
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
      while (id !== null && id !== "") {
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
        revisions: history.toReversed(),
      };
    });
    return { documents };
  };
  return captureTransaction
    ? await capture(captureTransaction)
    : await db.transaction(capture);
};
