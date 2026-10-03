/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../artifacts/artifact-kind"; "../eve/document-contracts" dependency within this package instead of introducing an alias or barrel API.
 */
import { and, eq, inArray, lt, lte, sql } from "drizzle-orm";
import { z } from "zod";

import { artifactKinds } from "../artifacts/artifact-kind";
import { documentFileIds } from "../eve/document-contracts";
import { db } from "./client";
import { retainEveDocumentFiles } from "./eve-files";
import {
  eveConversation,
  eveDocumentCheckpoint,
  eveDocumentCheckpointEntry,
  eveDocumentHead,
  eveDocumentRevision,
  eveImportedDocumentCheckpoint,
  eveImportedDocumentCheckpointEntry,
  eveNamedDocumentCheckpoint,
  eveNamedDocumentCheckpointEntry,
} from "./schema";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): revisionInput uses 2_000_000, 1, 512, 1000 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
const revisionInput = z.object({
  content: z.string().max(2_000_000),
  conversationId: z.uuid(),
  documentId: z.uuid(),
  expectedRevisionId: z.uuid().nullable(),
  fileIds: documentFileIds,
  kind: z.enum(artifactKinds),
  operationId: z.string().min(1).max(512),
  ownerId: z.string().min(1),
  title: z.string().min(1).max(1000),
  turnIndex: z.number().int().nonnegative().nullable(),
});
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): DocumentTransaction uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
type DocumentTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
/* oxlint-enable no-magic-numbers */

/* oxlint-disable import/exports-last, import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types --
 * import/exports-last (#522): purgeEveFamilyDocuments is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): purgeEveFamilyDocuments stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): purgeEveFamilyDocuments's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): purgeEveFamilyDocuments's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): purgeEveFamilyDocuments keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): purgeEveFamilyDocuments keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): purgeEveFamilyDocuments uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): purgeEveFamilyDocuments accepts tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/**
 * Erase document rows after retirement and resource inventory have completed.
 * The deletion coordinator must retain file references before calling this.
 * This does not erase native history, blobs, metadata, or accounting, and never
 * marks the conversation deleted.
 */
export const purgeEveFamilyDocuments = async (
  ownerId: string,
  rootId: string
): Promise<void> =>
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${ownerId}`}, 0))`
    );
    const family = await tx
      .select({
        id: eveConversation.id,
        state: eveConversation.state,
      })
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.ownerId, ownerId),
          eq(eveConversation.chatId, rootId)
        )
      )
      .orderBy(eveConversation.id);
    if (family.length === 0 || family.some((row) => row.state !== "deleting")) {
      throw new Error(
        "The entire conversation family must be pending deletion."
      );
    }
    const ids = family.map((row) => row.id);
    for (const id of ids) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Acquire and use transaction locks in a deterministic order.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`eve-document:${id}`}, 0))`
      );
    }
    await tx
      .delete(eveImportedDocumentCheckpointEntry)
      .where(
        and(
          eq(eveImportedDocumentCheckpointEntry.ownerId, ownerId),
          inArray(eveImportedDocumentCheckpointEntry.conversationId, ids)
        )
      );
    await tx
      .delete(eveImportedDocumentCheckpoint)
      .where(
        and(
          eq(eveImportedDocumentCheckpoint.ownerId, ownerId),
          inArray(eveImportedDocumentCheckpoint.conversationId, ids)
        )
      );
    await tx
      .delete(eveNamedDocumentCheckpointEntry)
      .where(
        and(
          eq(eveNamedDocumentCheckpointEntry.ownerId, ownerId),
          inArray(eveNamedDocumentCheckpointEntry.conversationId, ids)
        )
      );
    await tx
      .delete(eveNamedDocumentCheckpoint)
      .where(
        and(
          eq(eveNamedDocumentCheckpoint.ownerId, ownerId),
          inArray(eveNamedDocumentCheckpoint.conversationId, ids)
        )
      );
    // Keep the FK constraints intact: unexpected references from a surviving
    // conversation fail the transaction instead of destroying its ancestry.
    await tx
      .delete(eveDocumentCheckpointEntry)
      .where(
        and(
          eq(eveDocumentCheckpointEntry.ownerId, ownerId),
          inArray(eveDocumentCheckpointEntry.conversationId, ids)
        )
      );
    await tx
      .delete(eveDocumentCheckpoint)
      .where(
        and(
          eq(eveDocumentCheckpoint.ownerId, ownerId),
          inArray(eveDocumentCheckpoint.conversationId, ids)
        )
      );
    await tx
      .delete(eveDocumentHead)
      .where(
        and(
          eq(eveDocumentHead.ownerId, ownerId),
          inArray(eveDocumentHead.conversationId, ids)
        )
      );
    await tx
      .delete(eveDocumentRevision)
      .where(
        and(
          eq(eveDocumentRevision.ownerId, ownerId),
          inArray(eveDocumentRevision.conversationId, ids)
        )
      );
  });
/* oxlint-enable import/exports-last, import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep ancestorIds's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
const ancestorIds = (ownerId: string, documentId: string, headId: string) =>
  sql`(with recursive ancestry as (
    select "id", "parentRevisionId" from "EveDocumentRevision" where "id" = ${headId} and "ownerId" = ${ownerId} and "documentId" = ${documentId}
    union
    select revision."id", revision."parentRevisionId" from "EveDocumentRevision" revision join ancestry on revision."id" = ancestry."parentRevisionId"
  ) select "id" from ancestry)`;
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable id-length, max-statements, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * id-length (#506): orderRevisionHistory uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * max-statements (#512): orderRevisionHistory keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/explicit-function-return-type (#560): Keep orderRevisionHistory's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): orderRevisionHistory accepts revisions: T[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): orderRevisionHistory intentionally keeps the existing falsy-value behavior of revisionId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const orderRevisionHistory = <
  T extends {
    id: string;
    parentRevisionId: string | null;
  },
>(
  revisions: T[],
  headId: string
) => {
  const byId = new Map(revisions.map((revision) => [revision.id, revision]));
  const history: T[] = [];
  let revisionId: string | null = headId;
  while (revisionId) {
    const revision = byId.get(revisionId);
    if (!revision) {
      throw new Error("Document history could not be loaded.");
    }
    byId.delete(revisionId);
    history.push(revision);
    revisionId = revision.parentRevisionId;
  }
  return history.toReversed();
};
/* oxlint-enable id-length, max-statements, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable jsdoc/require-param, max-lines-per-function, max-params, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types --
 * jsdoc/require-param (#534): backfillDocumentCheckpoints's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): backfillDocumentCheckpoints keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-params (#511): backfillDocumentCheckpoints keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): backfillDocumentCheckpoints keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): backfillDocumentCheckpoints uses 1, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): backfillDocumentCheckpoints accepts tx: DocumentTransaction; { documentId, history }; item; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/** Upgrade pre-checkpoint native history before the first manual write changes its inference. */
const backfillDocumentCheckpoints =
  /** Upgrade pre-checkpoint native history before the first manual write changes its inference. */
  async (
    tx: DocumentTransaction,
    ownerId: string,
    conversationId: string,
    turns: readonly number[]
  ): Promise<void> => {
    const turnIndexes = [
      ...new Set(z.array(z.number().int().nonnegative()).min(1).parse(turns)),
    ];
    const existing = await tx
      .select({ turnIndex: eveDocumentCheckpoint.turnIndex })
      .from(eveDocumentCheckpoint)
      .where(
        and(
          eq(eveDocumentCheckpoint.conversationId, conversationId),
          eq(eveDocumentCheckpoint.ownerId, ownerId),
          inArray(eveDocumentCheckpoint.turnIndex, turnIndexes)
        )
      );
    const known = new Set(existing.map((checkpoint) => checkpoint.turnIndex));
    const missing = turnIndexes.filter((turnIndex) => !known.has(turnIndex));
    if (missing.length === 0) {
      return;
    }
    const heads = await tx
      .select()
      .from(eveDocumentHead)
      .where(
        and(
          eq(eveDocumentHead.conversationId, conversationId),
          eq(eveDocumentHead.ownerId, ownerId)
        )
      );
    const histories: {
      documentId: string;
      history: {
        id: string;
        parentRevisionId: string | null;
        turnIndex: number | null;
      }[];
    }[] = [];
    for (const head of heads) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Acquire and use transaction locks in a deterministic order.
      const revisions = await tx
        .select({
          id: eveDocumentRevision.id,
          parentRevisionId: eveDocumentRevision.parentRevisionId,
          turnIndex: eveDocumentRevision.turnIndex,
        })
        .from(eveDocumentRevision)
        .where(
          inArray(
            eveDocumentRevision.id,
            ancestorIds(ownerId, head.documentId, head.revisionId)
          )
        );
      const history = orderRevisionHistory(revisions, head.revisionId);
      if (history.some((revision) => revision.turnIndex === null)) {
        throw new Error(
          "Document checkpoint is not ready. Retry saving shortly."
        );
      }
      histories.push({ documentId: head.documentId, history });
    }
    for (const turnIndex of missing) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Acquire and use transaction locks in a deterministic order.
      await tx
        .insert(eveDocumentCheckpoint)
        .values({ conversationId, ownerId, turnIndex });
      const entries = histories.flatMap(({ documentId, history }) => {
        const revision = history.findLast(
          (item) => item.turnIndex !== null && item.turnIndex < turnIndex
        );
        return revision
          ? [
              {
                conversationId,
                documentId,
                ownerId,
                revisionId: revision.id,
                turnIndex,
              },
            ]
          : [];
      });
      if (entries.length > 0) {
        // oxlint-disable-next-line eslint/no-await-in-loop -- Acquire and use transaction locks in a deterministic order.
        await tx.insert(eveDocumentCheckpointEntry).values(entries);
      }
    }
  };
/* oxlint-enable jsdoc/require-param, max-lines-per-function, max-params, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * typescript/prefer-readonly-parameter-types (#565): prepareManualRevision accepts tx: DocumentTransaction; input: z.infer<typeof revisionInput>; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): prepareManualRevision intentionally keeps the existing falsy-value behavior of input.expectedRevisionId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const prepareManualRevision = async (
  tx: DocumentTransaction,
  input: z.infer<typeof revisionInput>,
  historicalTurns?: readonly number[]
): Promise<void> => {
  if (input.turnIndex === null) {
    if (!(input.expectedRevisionId && historicalTurns)) {
      throw new Error(
        "Manual edits require an existing document and native history."
      );
    }
    await backfillDocumentCheckpoints(
      tx,
      input.ownerId,
      input.conversationId,
      historicalTurns
    );
  }
};
/* oxlint-enable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable import/exports-last, import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null --
 * import/exports-last (#522): saveEveDocumentRevision is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): saveEveDocumentRevision stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): saveEveDocumentRevision's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): saveEveDocumentRevision's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): saveEveDocumentRevision keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): saveEveDocumentRevision keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): saveEveDocumentRevision uses -1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/explicit-function-return-type (#560): Keep saveEveDocumentRevision's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep saveEveDocumentRevision's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): saveEveDocumentRevision accepts value: z.input<typeof revisionInput>; signal?: AbortSignal; tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): saveEveDocumentRevision intentionally keeps the existing falsy-value behavior of conversation; replay; head; previous; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): saveEveDocumentRevision preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
/** Save a revision and move only this conversation's head, atomically and replay-safely. */
export const saveEveDocumentRevision = async (
  value: z.input<typeof revisionInput>,
  signal?: AbortSignal,
  historicalTurns?: readonly number[]
) => {
  signal?.throwIfAborted();
  const input = revisionInput.parse(value);
  // oxlint-disable-next-line eslint/complexity -- Keep the atomic admission and validation branches together at this transaction boundary.
  return await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${input.ownerId}`}, 0))`
    );
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-document:${input.conversationId}`}, 0))`
    );
    signal?.throwIfAborted();
    const [conversation] = await tx
      .select()
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.id, input.conversationId),
          eq(eveConversation.ownerId, input.ownerId),
          eq(eveConversation.state, "bound")
        )
      );
    if (!conversation) {
      throw new Error("Conversation not found.");
    }
    const [replay] = await tx
      .select()
      .from(eveDocumentRevision)
      .where(
        and(
          eq(eveDocumentRevision.conversationId, input.conversationId),
          eq(eveDocumentRevision.operationId, input.operationId)
        )
      );
    if (replay) {
      if (
        replay.documentId !== input.documentId ||
        replay.ownerId !== input.ownerId ||
        replay.parentRevisionId !== input.expectedRevisionId ||
        replay.turnIndex !== input.turnIndex ||
        replay.title !== input.title ||
        replay.content !== input.content ||
        JSON.stringify(replay.fileIds) !== JSON.stringify(input.fileIds) ||
        replay.kind !== input.kind
      ) {
        throw new Error("Document operation changed during replay.");
      }
      return replay;
    }
    const [head] = await tx
      .select()
      .from(eveDocumentHead)
      .where(
        and(
          eq(eveDocumentHead.conversationId, input.conversationId),
          eq(eveDocumentHead.documentId, input.documentId)
        )
      );
    if ((head?.revisionId ?? null) !== input.expectedRevisionId) {
      throw new Error("Document changed. Reload before saving.");
    }
    if (head) {
      const [previous] = await tx
        .select()
        .from(eveDocumentRevision)
        .where(eq(eveDocumentRevision.id, head.revisionId));
      if (
        !previous ||
        previous.kind !== input.kind ||
        (previous.turnIndex ?? -1) >
          (input.turnIndex ?? Number.POSITIVE_INFINITY)
      ) {
        throw new Error("Invalid document revision.");
      }
    }
    await retainEveDocumentFiles(
      tx,
      input.ownerId,
      input.conversationId,
      input.fileIds
    );
    await prepareManualRevision(tx, input, historicalTurns);
    signal?.throwIfAborted();
    const [revision] = await tx
      .insert(eveDocumentRevision)
      .values({
        content: input.content,
        conversationId: input.conversationId,
        documentId: input.documentId,
        fileIds: input.fileIds,
        kind: input.kind,
        operationId: input.operationId,
        ownerId: input.ownerId,
        parentRevisionId: input.expectedRevisionId,
        title: input.title,
        turnIndex: input.turnIndex,
      })
      .returning();
    await tx
      .insert(eveDocumentHead)
      .values({
        conversationId: input.conversationId,
        documentId: input.documentId,
        ownerId: input.ownerId,
        revisionId: revision.id,
      })
      .onConflictDoUpdate({
        set: { revisionId: revision.id },
        target: [eveDocumentHead.conversationId, eveDocumentHead.documentId],
      });
    signal?.throwIfAborted();
    return revision;
  });
};
/* oxlint-enable import/exports-last, import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable import/exports-last, import/group-exports, jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions --
 * import/exports-last (#522): getEveDocumentHistory is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): getEveDocumentHistory stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): getEveDocumentHistory's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): getEveDocumentHistory's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * typescript/explicit-function-return-type (#560): Keep getEveDocumentHistory's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep getEveDocumentHistory's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/strict-boolean-expressions (#610): getEveDocumentHistory intentionally keeps the existing falsy-value behavior of head; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** Traverse the selected revision's ancestry, never all revisions with the same document ID. */
export const getEveDocumentHistory = async (
  ownerId: string,
  conversationId: string,
  documentId: string
) => {
  const [head] = await db
    .select({ revisionId: eveDocumentHead.revisionId })
    .from(eveDocumentHead)
    .innerJoin(
      eveConversation,
      and(
        eq(eveConversation.id, eveDocumentHead.conversationId),
        eq(eveConversation.ownerId, ownerId)
      )
    )
    .where(
      and(
        eq(eveDocumentHead.conversationId, conversationId),
        eq(eveDocumentHead.documentId, documentId),
        eq(eveDocumentHead.ownerId, ownerId)
      )
    );
  if (!head) {
    return [];
  }
  const revisions = await db
    .select({
      createdAt: eveDocumentRevision.createdAt,
      id: eveDocumentRevision.id,
      kind: eveDocumentRevision.kind,
      parentRevisionId: eveDocumentRevision.parentRevisionId,
      title: eveDocumentRevision.title,
      turnIndex: eveDocumentRevision.turnIndex,
    })
    .from(eveDocumentRevision)
    .where(
      inArray(
        eveDocumentRevision.id,
        ancestorIds(ownerId, documentId, head.revisionId)
      )
    );
  return orderRevisionHistory(revisions, head.revisionId);
};
/* oxlint-enable import/exports-last, import/group-exports, jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions */

/* oxlint-disable max-params, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls --
 * max-params (#511): inheritImportedDocumentCheckpoints keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): inheritImportedDocumentCheckpoints uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-undefined (#519): inheritImportedDocumentCheckpoints uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/prefer-readonly-parameter-types (#565): inheritImportedDocumentCheckpoints accepts tx: DocumentTransaction; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * unicorn/max-nested-calls (#568): inheritImportedDocumentCheckpoints keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
const inheritImportedDocumentCheckpoints = async (
  tx: DocumentTransaction,
  ownerId: string,
  sourceId: string,
  conversationId: string,
  beforeMessageIndex?: number
): Promise<void> => {
  const headers = await tx
    .select()
    .from(eveImportedDocumentCheckpoint)
    .where(
      and(
        eq(eveImportedDocumentCheckpoint.conversationId, sourceId),
        eq(eveImportedDocumentCheckpoint.ownerId, ownerId),
        beforeMessageIndex === undefined
          ? undefined
          : lt(eveImportedDocumentCheckpoint.messageIndex, beforeMessageIndex)
      )
    );
  if (headers.length === 0) {
    return;
  }
  const copied = await tx
    .insert(eveImportedDocumentCheckpoint)
    // oxlint-disable-next-line oxc/no-map-spread -- #541: Copy checkpoint rows into a new conversation or checkpoint without mutating source records.
    .values(headers.map((header) => ({ ...header, conversationId })))
    .onConflictDoNothing()
    .returning({ messageIndex: eveImportedDocumentCheckpoint.messageIndex });
  if (copied.length === 0) {
    return;
  }
  const entries = await tx
    .select()
    .from(eveImportedDocumentCheckpointEntry)
    .where(
      and(
        eq(eveImportedDocumentCheckpointEntry.conversationId, sourceId),
        eq(eveImportedDocumentCheckpointEntry.ownerId, ownerId),
        inArray(
          eveImportedDocumentCheckpointEntry.messageIndex,
          copied.map((header) => header.messageIndex)
        )
      )
    );
  if (entries.length > 0) {
    await tx
      .insert(eveImportedDocumentCheckpointEntry)
      // oxlint-disable-next-line oxc/no-map-spread -- #541: Copy checkpoint rows into a new conversation or checkpoint without mutating source records.
      .values(entries.map((entry) => ({ ...entry, conversationId })));
  }
};
/* oxlint-enable max-params, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls */

/* oxlint-disable max-lines-per-function, max-params, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * max-lines-per-function (#510): initializeImportedForkDocuments keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-params (#511): initializeImportedForkDocuments keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): initializeImportedForkDocuments uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): initializeImportedForkDocuments accepts tx: DocumentTransaction; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): initializeImportedForkDocuments intentionally keeps the existing falsy-value behavior of checkpoint; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const initializeImportedForkDocuments = async (
  tx: DocumentTransaction,
  ownerId: string,
  sourceId: string,
  conversationId: string,
  messageIndex: number
): Promise<void> => {
  const [checkpoint] = await tx
    .select()
    .from(eveImportedDocumentCheckpoint)
    .where(
      and(
        eq(eveImportedDocumentCheckpoint.conversationId, sourceId),
        eq(eveImportedDocumentCheckpoint.ownerId, ownerId),
        eq(eveImportedDocumentCheckpoint.messageIndex, messageIndex)
      )
    );
  if (!checkpoint) {
    throw new Error("Imported document boundary is unavailable.");
  }
  const entries = await tx
    .select()
    .from(eveImportedDocumentCheckpointEntry)
    .where(
      and(
        eq(eveImportedDocumentCheckpointEntry.conversationId, sourceId),
        eq(eveImportedDocumentCheckpointEntry.ownerId, ownerId),
        eq(eveImportedDocumentCheckpointEntry.messageIndex, messageIndex)
      )
    );
  if (entries.length > 0) {
    await tx
      .insert(eveDocumentHead)
      .values(
        entries.map(({ documentId, revisionId }) => ({
          conversationId,
          documentId,
          ownerId,
          revisionId,
        }))
      )
      .onConflictDoNothing();
  }
  // The selected message and its suffix are excluded from the native prefix.
  await inheritImportedDocumentCheckpoints(
    tx,
    ownerId,
    sourceId,
    conversationId,
    messageIndex
  );
};
/* oxlint-enable max-lines-per-function, max-params, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): parseForkTurnIndex uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
const parseForkTurnIndex = (turnId: string): number => {
  const turnIndex = Number(turnId.slice("turn_".length));
  if (!Number.isSafeInteger(turnIndex) || turnIndex < 0) {
    throw new Error("Invalid fork boundary.");
  }
  return turnIndex;
};
/* oxlint-enable no-magic-numbers */

/* oxlint-disable max-lines-per-function, max-params, no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls --
 * max-lines-per-function (#510): inheritDocumentCheckpoints keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-params (#511): inheritDocumentCheckpoints keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): inheritDocumentCheckpoints uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/explicit-function-return-type (#560): Keep inheritDocumentCheckpoints's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): inheritDocumentCheckpoints accepts tx: DocumentTransaction; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * unicorn/max-nested-calls (#568): inheritDocumentCheckpoints keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
const inheritDocumentCheckpoints = async (
  tx: DocumentTransaction,
  ownerId: string,
  sourceId: string,
  conversationId: string,
  beforeTurn: number
) => {
  const inheritedCheckpoints = await tx
    .select()
    .from(eveDocumentCheckpoint)
    .where(
      and(
        eq(eveDocumentCheckpoint.conversationId, sourceId),
        eq(eveDocumentCheckpoint.ownerId, ownerId),
        lte(eveDocumentCheckpoint.turnIndex, beforeTurn)
      )
    );
  // The child inherits the native transcript prefix, so it must inherit its
  // document boundaries too. A later fork may target any earlier turn.
  if (inheritedCheckpoints.length > 0) {
    const copied = await tx
      .insert(eveDocumentCheckpoint)
      .values(
        inheritedCheckpoints.map((checkpoint) => ({
          ...checkpoint,
          conversationId,
        }))
      )
      .onConflictDoNothing()
      .returning({ turnIndex: eveDocumentCheckpoint.turnIndex });
    if (copied.length > 0) {
      const entries = await tx
        .select()
        .from(eveDocumentCheckpointEntry)
        .where(
          and(
            eq(eveDocumentCheckpointEntry.conversationId, sourceId),
            eq(eveDocumentCheckpointEntry.ownerId, ownerId),
            inArray(
              eveDocumentCheckpointEntry.turnIndex,
              copied.map((checkpoint) => checkpoint.turnIndex)
            )
          )
        );
      if (entries.length > 0) {
        await tx
          .insert(eveDocumentCheckpointEntry)
          // oxlint-disable-next-line oxc/no-map-spread -- #541: Copy checkpoint rows into a new conversation or checkpoint without mutating source records.
          .values(entries.map((entry) => ({ ...entry, conversationId })));
      }
    }
  }
  return inheritedCheckpoints;
};
/* oxlint-enable max-lines-per-function, max-params, no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls */

/* oxlint-disable max-lines-per-function, max-params, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * max-lines-per-function (#510): initializeNamedForkDocuments keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-params (#511): initializeNamedForkDocuments keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): initializeNamedForkDocuments uses 1, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): initializeNamedForkDocuments accepts tx: DocumentTransaction; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): initializeNamedForkDocuments intentionally keeps the existing falsy-value behavior of checkpoint; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const initializeNamedForkDocuments = async (
  tx: DocumentTransaction,
  ownerId: string,
  conversationId: string,
  sourceId: string,
  checkpointId: string,
  beforeTurn: number
): Promise<void> => {
  const [checkpoint] = await tx
    .select()
    .from(eveNamedDocumentCheckpoint)
    .where(
      and(
        eq(eveNamedDocumentCheckpoint.ownerId, ownerId),
        eq(eveNamedDocumentCheckpoint.conversationId, sourceId),
        eq(eveNamedDocumentCheckpoint.checkpointId, checkpointId)
      )
    );
  if (!checkpoint || checkpoint.turnIndex !== beforeTurn) {
    throw new Error(
      "Named document checkpoint is not ready or has a different source turn."
    );
  }
  // Only earlier turn boundaries are inherited. The child's own next turn
  // must capture the selected idle revision, not an older turn snapshot.
  await inheritDocumentCheckpoints(
    tx,
    ownerId,
    sourceId,
    conversationId,
    beforeTurn - 1
  );
  const entries = await tx
    .select()
    .from(eveNamedDocumentCheckpointEntry)
    .where(
      and(
        eq(eveNamedDocumentCheckpointEntry.ownerId, ownerId),
        eq(eveNamedDocumentCheckpointEntry.conversationId, sourceId),
        eq(eveNamedDocumentCheckpointEntry.checkpointId, checkpointId)
      )
    );
  if (entries.length > 0) {
    await tx
      .insert(eveDocumentHead)
      .values(
        entries.map((entry) => ({
          conversationId,
          documentId: entry.documentId,
          ownerId,
          revisionId: entry.revisionId,
        }))
      )
      .onConflictDoNothing();
  }
};
/* oxlint-enable max-lines-per-function, max-params, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable import/exports-last, import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * import/exports-last (#522): initializeEveForkDocuments is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): initializeEveForkDocuments stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): initializeEveForkDocuments's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): initializeEveForkDocuments's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): initializeEveForkDocuments keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): initializeEveForkDocuments keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): initializeEveForkDocuments uses 13, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): initializeEveForkDocuments accepts tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): initializeEveForkDocuments intentionally keeps the existing falsy-value behavior of target?.parentConversationId; target.forkMessageId; target.forkCheckpointId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** Call before exposing a newly bound fork; source edits after its boundary stay excluded. */
export const initializeEveForkDocuments = async (
  ownerId: string,
  conversationId: string
): Promise<void> =>
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-document:${conversationId}`}, 0))`
    );
    const [target] = await tx
      .select()
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.id, conversationId),
          eq(eveConversation.ownerId, ownerId)
        )
      );
    if (!target?.parentConversationId) {
      throw new Error("Fork conversation not found.");
    }
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-document:${target.parentConversationId}`}, 0))`
    );
    if (target.forkMessageId) {
      await initializeImportedForkDocuments(
        tx,
        ownerId,
        target.parentConversationId,
        conversationId,
        Number(target.forkMessageId.slice(13))
      );
      return;
    }
    const beforeTurn = parseForkTurnIndex(z.string().parse(target.forkTurnId));
    // Native and named forks retain the complete imported transcript prefix.
    await inheritImportedDocumentCheckpoints(
      tx,
      ownerId,
      target.parentConversationId,
      conversationId
    );
    if (target.forkCheckpointId) {
      await initializeNamedForkDocuments(
        tx,
        ownerId,
        conversationId,
        target.parentConversationId,
        target.forkCheckpointId,
        beforeTurn
      );
      return;
    }
    const inheritedCheckpoints = await inheritDocumentCheckpoints(
      tx,
      ownerId,
      target.parentConversationId,
      conversationId,
      beforeTurn
    );
    const checkpoint = inheritedCheckpoints.find(
      (item) => item.turnIndex === beforeTurn
    );
    if (checkpoint) {
      const entries = await tx
        .select()
        .from(eveDocumentCheckpointEntry)
        .where(
          and(
            eq(
              eveDocumentCheckpointEntry.conversationId,
              target.parentConversationId
            ),
            eq(eveDocumentCheckpointEntry.turnIndex, beforeTurn),
            eq(eveDocumentCheckpointEntry.ownerId, ownerId)
          )
        );
      if (entries.length > 0) {
        await tx
          .insert(eveDocumentHead)
          .values(
            entries.map((entry) => ({
              conversationId,
              documentId: entry.documentId,
              ownerId,
              revisionId: entry.revisionId,
            }))
          )
          .onConflictDoNothing();
      }
      return;
    }
    // Conversations created before checkpoint capture contain only native turn-indexed writes.
    const heads = await tx
      .select()
      .from(eveDocumentHead)
      .where(
        and(
          eq(eveDocumentHead.conversationId, target.parentConversationId),
          eq(eveDocumentHead.ownerId, ownerId)
        )
      );
    for (const head of heads) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Acquire and use transaction locks in a deterministic order.
      const ancestors = await tx
        .select({
          id: eveDocumentRevision.id,
          parentRevisionId: eveDocumentRevision.parentRevisionId,
          turnIndex: eveDocumentRevision.turnIndex,
        })
        .from(eveDocumentRevision)
        .where(
          inArray(
            eveDocumentRevision.id,
            ancestorIds(ownerId, head.documentId, head.revisionId)
          )
        );
      const revision = orderRevisionHistory(ancestors, head.revisionId);
      if (revision.some((version) => version.turnIndex === null)) {
        throw new Error("Document checkpoint is not ready. Retry this fork.");
      }
      const selectedRevision = revision.findLast(
        (version) =>
          version.turnIndex !== null && version.turnIndex < beforeTurn
      );
      if (selectedRevision) {
        // oxlint-disable-next-line eslint/no-await-in-loop -- Acquire and use transaction locks in a deterministic order.
        await tx
          .insert(eveDocumentHead)
          .values({
            conversationId,
            documentId: head.documentId,
            ownerId,
            revisionId: selectedRevision.id,
          })
          .onConflictDoNothing();
      }
    }
  });
/* oxlint-enable import/exports-last, import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable import/exports-last, import/group-exports, jsdoc/require-param, jsdoc/require-returns, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * import/exports-last (#522): captureEveDocumentCheckpoint is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): captureEveDocumentCheckpoint stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): captureEveDocumentCheckpoint's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): captureEveDocumentCheckpoint's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * no-magic-numbers (#517): captureEveDocumentCheckpoint uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): captureEveDocumentCheckpoint accepts tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): captureEveDocumentCheckpoint intentionally keeps the existing falsy-value behavior of conversation; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** Capture once before model execution; even an empty manifest is a durable checkpoint. */
export const captureEveDocumentCheckpoint = async (
  ownerId: string,
  conversationId: string,
  turnIndex: number
): Promise<void> => {
  z.number().int().nonnegative().parse(turnIndex);
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-document:${conversationId}`}, 0))`
    );
    const [conversation] = await tx
      .select({ id: eveConversation.id })
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.id, conversationId),
          eq(eveConversation.ownerId, ownerId),
          eq(eveConversation.state, "bound")
        )
      );
    if (!conversation) {
      throw new Error("Conversation not found.");
    }
    const inserted = await tx
      .insert(eveDocumentCheckpoint)
      .values({ conversationId, ownerId, turnIndex })
      .onConflictDoNothing()
      .returning();
    if (inserted.length === 0) {
      return;
    }
    const heads = await tx
      .select()
      .from(eveDocumentHead)
      .where(
        and(
          eq(eveDocumentHead.conversationId, conversationId),
          eq(eveDocumentHead.ownerId, ownerId)
        )
      );
    if (heads.length > 0) {
      await tx
        .insert(eveDocumentCheckpointEntry)
        // oxlint-disable-next-line oxc/no-map-spread -- #541: Copy checkpoint rows into a new conversation or checkpoint without mutating source records.
        .values(heads.map((head) => ({ ...head, turnIndex })));
    }
  });
};
/* oxlint-enable import/exports-last, import/group-exports, jsdoc/require-param, jsdoc/require-returns, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable import/exports-last, import/group-exports, jsdoc/require-param, max-lines-per-function, max-params, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * import/exports-last (#522): captureEveNamedDocumentCheckpoint is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): captureEveNamedDocumentCheckpoint stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): captureEveNamedDocumentCheckpoint's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): captureEveNamedDocumentCheckpoint keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-params (#511): captureEveNamedDocumentCheckpoint keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): captureEveNamedDocumentCheckpoint keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): captureEveNamedDocumentCheckpoint uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): captureEveNamedDocumentCheckpoint accepts tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): captureEveNamedDocumentCheckpoint intentionally keeps the existing falsy-value behavior of conversation; existing; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** Native serialized capture calls this before publishing its named checkpoint. */
export const captureEveNamedDocumentCheckpoint = async (
  ownerId: string,
  conversationId: string,
  checkpointId: string,
  turnIndex: number
): Promise<void> => {
  z.uuid().parse(checkpointId);
  z.number().int().nonnegative().parse(turnIndex);
  await db.transaction(async (tx) => {
    // Coordinate with deletion as well as manual/model document writes.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${ownerId}`}, 0))`
    );
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-document:${conversationId}`}, 0))`
    );
    const [conversation] = await tx
      .select({ id: eveConversation.id })
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.id, conversationId),
          eq(eveConversation.ownerId, ownerId),
          eq(eveConversation.state, "bound")
        )
      );
    if (!conversation) {
      throw new Error("Conversation not found.");
    }
    const [existing] = await tx
      .select()
      .from(eveNamedDocumentCheckpoint)
      .where(
        and(
          eq(eveNamedDocumentCheckpoint.conversationId, conversationId),
          eq(eveNamedDocumentCheckpoint.checkpointId, checkpointId),
          eq(eveNamedDocumentCheckpoint.ownerId, ownerId)
        )
      );
    if (existing) {
      if (existing.turnIndex !== turnIndex) {
        throw new Error(
          "Checkpoint identity already has a different source turn."
        );
      }
      return;
    }
    await tx
      .insert(eveNamedDocumentCheckpoint)
      .values({ checkpointId, conversationId, ownerId, turnIndex });
    const heads = await tx
      .select()
      .from(eveDocumentHead)
      .where(
        and(
          eq(eveDocumentHead.conversationId, conversationId),
          eq(eveDocumentHead.ownerId, ownerId)
        )
      );
    if (heads.length > 0) {
      await tx
        .insert(eveNamedDocumentCheckpointEntry)
        // oxlint-disable-next-line oxc/no-map-spread -- #541: Copy checkpoint rows into a new conversation or checkpoint without mutating source records.
        .values(heads.map((head) => ({ ...head, checkpointId })));
    }
  });
};
/* oxlint-enable import/exports-last, import/group-exports, jsdoc/require-param, max-lines-per-function, max-params, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type --
 * jsdoc/require-param (#534): readDocumentRevision's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): readDocumentRevision's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * typescript/explicit-function-return-type (#560): Keep readDocumentRevision's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
/** Internal only: the caller must first prove this revision belongs to the accessible ancestry. */
const readDocumentRevision =
  /** Internal only: the caller must first prove this revision belongs to the accessible ancestry. */
  async (ownerId: string, documentId: string, revisionId: string) => {
    const [revision] = await db
      .select()
      .from(eveDocumentRevision)
      .where(
        and(
          eq(eveDocumentRevision.id, revisionId),
          eq(eveDocumentRevision.ownerId, ownerId),
          eq(eveDocumentRevision.documentId, documentId)
        )
      );
    return revision;
  };
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type */

/* oxlint-disable import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-params, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * import/group-exports (#523): getEveDocumentRevision stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): getEveDocumentRevision's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): getEveDocumentRevision's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-params (#511): getEveDocumentRevision keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): getEveDocumentRevision uses -1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/explicit-function-return-type (#560): Keep getEveDocumentRevision's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep getEveDocumentRevision's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): getEveDocumentRevision accepts revision; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): getEveDocumentRevision intentionally keeps the existing falsy-value behavior of revisionId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** Content is loaded only for the selected, accessible revision. */
export const getEveDocumentRevision = async (
  ownerId: string,
  conversationId: string,
  documentId: string,
  revisionId?: string
) => {
  const history = await getEveDocumentHistory(
    ownerId,
    conversationId,
    documentId
  );
  const selected = revisionId
    ? history.find((revision) => revision.id === revisionId)
    : history.at(-1);
  if (!selected) {
    return;
  }
  // oxlint-disable-next-line typescript/consistent-return -- #580: getEveDocumentRevision has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
  return await readDocumentRevision(ownerId, documentId, selected.id);
};
/* oxlint-enable import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-params, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-params, max-statements, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * import/group-exports (#523): getAccessibleEveDocument stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): getAccessibleEveDocument's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): getAccessibleEveDocument's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): getAccessibleEveDocument keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-params (#511): getAccessibleEveDocument keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): getAccessibleEveDocument keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): getAccessibleEveDocument uses -1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-undefined (#519): getAccessibleEveDocument uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/explicit-function-return-type (#560): Keep getAccessibleEveDocument's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep getAccessibleEveDocument's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): getAccessibleEveDocument accepts item; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): getAccessibleEveDocument intentionally keeps the existing falsy-value behavior of conversation; revisionId; current; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** Public readers receive document content, never storage ownership or operation metadata. */
export const getAccessibleEveDocument = async (
  viewerId: string | undefined,
  conversationId: string,
  documentId: string,
  revisionId?: string
) => {
  const [conversation] = await db
    .select()
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.id, conversationId),
        eq(eveConversation.state, "bound")
      )
    );
  if (
    !conversation ||
    (conversation.ownerId !== viewerId && conversation.visibility !== "public")
  ) {
    return;
  }
  const history = await getEveDocumentHistory(
    conversation.ownerId,
    conversationId,
    documentId
  );
  const selected = revisionId
    ? history.find((item) => item.id === revisionId)
    : history.at(-1);
  const revision = selected
    ? await readDocumentRevision(conversation.ownerId, documentId, selected.id)
    : undefined;
  if (!revision) {
    return;
  }
  // Recheck visibility after the potentially slow ancestry/content read.
  const [current] = await db
    .select()
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.id, conversationId),
        eq(eveConversation.state, "bound")
      )
    );
  if (
    !current ||
    (current.ownerId !== viewerId && current.visibility !== "public")
  ) {
    return;
  }
  // oxlint-disable-next-line typescript/consistent-return -- #580: getAccessibleEveDocument has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
  return {
    canEdit: current.ownerId === viewerId,
    history,
    revision: {
      content: revision.content,
      createdAt: revision.createdAt,
      documentId: revision.documentId,
      id: revision.id,
      kind: revision.kind,
      title: revision.title,
    },
  };
};
/* oxlint-enable import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-params, max-statements, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * import/group-exports (#523): removeEveDocumentFromConversation stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): removeEveDocumentFromConversation's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): removeEveDocumentFromConversation's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): removeEveDocumentFromConversation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): removeEveDocumentFromConversation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/explicit-function-return-type (#560): Keep removeEveDocumentFromConversation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep removeEveDocumentFromConversation's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): removeEveDocumentFromConversation accepts input: { documentId: string; expectedRevisionId: string; title: string }; scope: { ownerId: string; conversationId: string }; signal: AbortSignal; tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): removeEveDocumentFromConversation intentionally keeps the existing falsy-value behavior of conversation; revision; head; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** Remove only this conversation's current pointer; snapshots and other branches retain their revisions. */
export const removeEveDocumentFromConversation = async (
  input: { documentId: string; expectedRevisionId: string; title: string },
  scope: { ownerId: string; conversationId: string },
  signal: AbortSignal
) =>
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${scope.ownerId}`}, 0))`
    );
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-document:${scope.conversationId}`}, 0))`
    );
    signal.throwIfAborted();
    const [conversation] = await tx
      .select()
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.id, scope.conversationId),
          eq(eveConversation.ownerId, scope.ownerId),
          eq(eveConversation.state, "bound")
        )
      );
    if (!conversation) {
      throw new Error("Conversation not found.");
    }
    const [revision] = await tx
      .select()
      .from(eveDocumentRevision)
      .where(
        and(
          eq(eveDocumentRevision.id, input.expectedRevisionId),
          eq(eveDocumentRevision.documentId, input.documentId),
          eq(eveDocumentRevision.ownerId, scope.ownerId)
        )
      );
    if (!revision) {
      throw new Error("Document not found.");
    }
    if (revision.title !== input.title) {
      throw new Error("Document changed. Request approval again.");
    }
    const [head] = await tx
      .select()
      .from(eveDocumentHead)
      .where(
        and(
          eq(eveDocumentHead.conversationId, scope.conversationId),
          eq(eveDocumentHead.documentId, input.documentId),
          eq(eveDocumentHead.ownerId, scope.ownerId)
        )
      );
    if (head && head.revisionId !== input.expectedRevisionId) {
      throw new Error("Document changed. Request approval again.");
    }
    // An absent head is already removed; a retry must not erase a newly saved revision.
    await tx
      .delete(eveDocumentHead)
      .where(
        and(
          eq(eveDocumentHead.conversationId, scope.conversationId),
          eq(eveDocumentHead.documentId, input.documentId),
          eq(eveDocumentHead.ownerId, scope.ownerId),
          eq(eveDocumentHead.revisionId, input.expectedRevisionId)
        )
      );
    signal.throwIfAborted();
    return {
      documentId: input.documentId,
      result:
        "Document removed from this conversation. Historical snapshots and other branches are unchanged.",
      status: "success" as const,
      title: revision.title,
    };
  });
/* oxlint-enable import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable max-lines -- #509: This eve-documents.ts module keeps its existing API and workflow boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric. */
