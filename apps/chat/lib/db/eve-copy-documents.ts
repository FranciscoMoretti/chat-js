/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../eve/copy-boundaries" dependency within this package instead of introducing an alias or barrel API.
 */
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
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable id-length, max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types --
 * id-length (#506): snapshotCopyCheckpoints uses a; b as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * max-lines-per-function (#510): snapshotCopyCheckpoints keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): snapshotCopyCheckpoints keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): snapshotCopyCheckpoints uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/explicit-function-return-type (#560): Keep snapshotCopyCheckpoints's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): snapshotCopyCheckpoints accepts tx: Parameters<Parameters<typeof db.transaction>[0]>[0]; input: { conversationId: string; ownerId: string; documentIds: string[]; boundaries:; boundary; a; b; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
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
      if (byId.get(head.revisionId)?.documentId !== head.documentId) {
        throw new Error(
          "Published document boundary is outside accessible ancestry."
        );
      }
    }
    return {
      heads: heads.toSorted((a, b) => a.documentId.localeCompare(b.documentId)),
      messageIndex: boundary.messageIndex,
    };
  });
  return checkpoints;
};
/* oxlint-enable id-length, max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-params, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/max-nested-calls --
 * jsdoc/require-param (#534): snapshotPublicEveCopyDocuments's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): snapshotPublicEveCopyDocuments's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
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
/** Internal copy preparation: IDs must come from the sanitized published transcript. */
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-params, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/max-nested-calls */
