import { and, eq, inArray, sql } from "drizzle-orm";

import type { EveCopyBoundary } from "@/lib/eve/copy-boundaries";

import { db } from "./client";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  eveConversation,
  eveDocumentCheckpoint,
  eveDocumentCheckpointEntry,
  eveDocumentHead,
  eveDocumentRevision,
  eveImportedDocumentCheckpoint,
  eveImportedDocumentCheckpointEntry,
} from "./schema";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve snapshotCopyCheckpoints's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable sort-imports */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types --
 * max-lines-per-function (#510): snapshotCopyCheckpoints keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): snapshotCopyCheckpoints keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): snapshotCopyCheckpoints uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/explicit-function-return-type (#560): Keep snapshotCopyCheckpoints's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): snapshotCopyCheckpoints accepts tx: Parameters<Parameters<typeof db.transaction>[0]>[0]; input: { conversationId: string; ownerId: string; documentIds: string[]; boundaries:; boundary; leftHead; rightHead; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const snapshotCopyCheckpoints = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: {
    conversationId: string;
    ownerId: string;
    documentIds: string[];
    boundaries: readonly EveCopyBoundary[];
    byId: ReadonlyMap<
      string,
      {
        documentId: string;
      }
    >;
  }
) => {
  const { conversationId, ownerId, documentIds, boundaries, byId } = input;
  const checkpointHeaders = new Set<string>();
  const checkpointEntries = new Map<
    string,
    {
      documentId: string;
      revisionId: string;
    }[]
  >();
  const turns = boundaries
    .filter((boundary) => boundary.sourceKind === "turn")
    .map((boundary) => boundary.sourceIndex);
  const imported = boundaries
    .filter((boundary) => boundary.sourceKind === "imported")
    .map((boundary) => boundary.sourceIndex);
  if (turns.length > 0 && documentIds.length > 0) {
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
  if (imported.length > 0 && documentIds.length > 0) {
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
    if (documentIds.length > 0 && !checkpointHeaders.has(key)) {
      throw new Error("Published document boundary is unavailable.");
    }
    const heads = checkpointEntries.get(key) ?? [];
    for (const head of heads) {
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading documentId from byId.get(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      if (byId.get(head.revisionId)?.documentId !== head.documentId) {
        throw new Error(
          "Published document boundary is outside accessible ancestry."
        );
      }
    }
    return {
      heads: heads.toSorted((leftHead, rightHead) =>
        leftHead.documentId.localeCompare(rightHead.documentId)
      ),
      messageIndex: boundary.messageIndex,
    };
  });
  return checkpoints;
};
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (snapshotPublicEveCopyDocuments); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve snapshotPublicEveCopyDocuments's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-lines-per-function, max-params, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/max-nested-calls --
 * max-lines-per-function (#510): snapshotPublicEveCopyDocuments keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-params (#511): snapshotPublicEveCopyDocuments keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): snapshotPublicEveCopyDocuments keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): snapshotPublicEveCopyDocuments uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/explicit-function-return-type (#560): Keep snapshotPublicEveCopyDocuments's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep snapshotPublicEveCopyDocuments's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): snapshotPublicEveCopyDocuments accepts resources: { documentIds: readonly string[]; revisionIds: readonly string[]; }; boundaries: readonly EveCopyBoundary[]; tx; revision; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): snapshotPublicEveCopyDocuments intentionally keeps the existing falsy-value behavior of identity; source; id; distinguishing empty, zero, and absent states requires a domain behavior decision.
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
    documentIds: readonly string[];
    revisionIds: readonly string[];
  },
  boundaries: readonly EveCopyBoundary[]
) => {
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
  });
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-params, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/max-nested-calls */
