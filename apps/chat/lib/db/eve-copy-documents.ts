import { and, eq, inArray, sql } from "drizzle-orm";

import type { EveCopyBoundary } from "@/lib/eve/copy-boundaries";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import { db } from "./client";
import { snapshotCopyCheckpoints } from "./eve-documents";
/* oxlint-disable sort-imports -- Keep schema pgTable construction after the client and eve-documents imports; eve-documents has top-level Zod schema construction and imports the client. */
import {
  eveConversation,
  eveDocumentHead,
  eveDocumentRevision,
} from "./schema";
/* oxlint-enable sort-imports */

const FIRST_ROW_INDEX = 0;

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (snapshotPublicEveCopyDocuments); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve snapshotPublicEveCopyDocuments's awaited sequencing and rejected-Promise behavior. */

/* oxlint-disable max-lines-per-function, max-params, max-statements, no-magic-numbers, unicorn/max-nested-calls --
 * max-lines-per-function (#510): snapshotPublicEveCopyDocuments keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-params (#511): snapshotPublicEveCopyDocuments keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): snapshotPublicEveCopyDocuments keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): snapshotPublicEveCopyDocuments uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.

 *

 * unicorn/max-nested-calls (#568): snapshotPublicEveCopyDocuments keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
/**
 * Captures published document heads, their revision ancestry, and checkpoint metadata.
 * Conversation and document locks keep the snapshot consistent with writers and deletion.
 * IDs must come from the sanitized published transcript.
 * @param {string} conversationId Public source conversation to copy from.
 * @param {string} sessionId Native session ID currently bound to the source.
 * @param {{ documentIds: readonly string[]; revisionIds: readonly string[] }} resources Document and revision IDs referenced by the published transcript.
 * @param {readonly EveCopyBoundary[]} boundaries Checkpoint boundaries to preserve in the copy snapshot.
 * @returns {Promise<{ checkpoints: Array<{ heads: Array<{ documentId: string; revisionId: string }>; messageIndex: number }>; documents: Array<{ documentId: string; headRevisionId: string; revisions: Array<Pick<typeof eveDocumentRevision.$inferSelect, "content" | "createdAt" | "documentId" | "fileIds" | "id" | "kind" | "parentRevisionId" | "title">> }> }>} Accessible documents and checkpoints captured under the source locks.
 * @throws {Error} when the source is unavailable or a referenced document or revision is inaccessible.
 */
export const snapshotPublicEveCopyDocuments = async (
  conversationId: string,
  sessionId: string,
  resources: {
    readonly documentIds: readonly string[];
    readonly revisionIds: readonly string[];
  },
  boundaries: readonly EveCopyBoundary[]
): Promise<{
  checkpoints: Awaited<ReturnType<typeof snapshotCopyCheckpoints>>;
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
  const identityRows = await db
    .select({ ownerId: eveConversation.ownerId })
    .from(eveConversation)
    .where(eq(eveConversation.id, conversationId));
  const identity = identityRows.at(FIRST_ROW_INDEX);
  if (!identity) {
    throw new Error("Shared conversation is unavailable.");
  }
  return await db.transaction(
    async (tx: Readonly<Pick<typeof db, "execute" | "select">>) => {
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
        // oxlint-disable-next-line no-ternary -- Keep heads as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
        // oxlint-disable-next-line no-ternary -- Keep revisions as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
      const checkpoints = await snapshotCopyCheckpoints(tx, {
        boundaries,
        byId,
        conversationId,
        documentIds,
        ownerId: identity.ownerId,
      });
      return { checkpoints, documents };
    }
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-params, max-statements, no-magic-numbers, unicorn/max-nested-calls */
