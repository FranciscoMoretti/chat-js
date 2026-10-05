import { and, eq, inArray, lt, lte, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { artifactKinds } from "@/lib/artifacts/artifact-kind";
/* oxlint-enable sort-imports */
import { documentFileIds } from "@/lib/eve/document-contracts";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
/* oxlint-enable sort-imports */

import { db } from "./client";
import { retainEveDocumentFiles } from "./eve-files";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
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
/* oxlint-enable sort-imports */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): revisionInput uses 2_000_000, 1, 512, 1000 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
const FIRST_ROW_INDEX = 0;

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
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve purgeEveFamilyDocuments's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types -- moving it below executable initialization can obscure ordering and API ownership.
max-lines-per-function (#510): purgeEveFamilyDocuments keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): purgeEveFamilyDocuments keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): purgeEveFamilyDocuments uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/prefer-readonly-parameter-types (#565): purgeEveFamilyDocuments accepts tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
/**
 * Erase document rows after retirement and resource inventory have completed.
 * The deletion coordinator must retain file references before calling this.
 * This does not erase native history, blobs, metadata, or accounting, and never
 * marks the conversation deleted.
 * @param {string} ownerId - Owner whose entire conversation family is already retiring.
 * @param {string} rootId - Chat identity selecting the family pending deletion.
 * @returns {Promise<void>} Completion after document rows are erased in the locked transaction.
 */
const purgeEveFamilyDocuments = async (
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types */

const ancestorIds = (
  ownerId: string,
  documentId: string,
  headId: string
): SQL =>
  sql`(with recursive ancestry as (
    select "id", "parentRevisionId" from "EveDocumentRevision" where "id" = ${headId} and "ownerId" = ${ownerId} and "documentId" = ${documentId}
    union
    select revision."id", revision."parentRevisionId" from "EveDocumentRevision" revision join ancestry on revision."id" = ancestry."parentRevisionId"
  ) select "id" from ancestry)`;

/* oxlint-disable id-length, max-statements -- * id-length (#506): orderRevisionHistory uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * max-statements (#512): orderRevisionHistory keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold. */
const orderRevisionHistory = <
  T extends {
    readonly id: string;
    readonly parentRevisionId: string | null;
  },
>(
  revisions: readonly T[],
  headId: string
): T[] => {
  const byId = new Map(revisions.map((revision) => [revision.id, revision]));
  const history: T[] = [];
  let revisionId: string | null = headId;
  while (revisionId !== null && revisionId !== "") {
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
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve backfillDocumentCheckpoints's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable id-length, max-statements */

/* oxlint-disable max-lines-per-function, max-params, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types -- * max-lines-per-function (#510): backfillDocumentCheckpoints keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-params (#511): backfillDocumentCheckpoints keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): backfillDocumentCheckpoints keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): backfillDocumentCheckpoints uses 1, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): backfillDocumentCheckpoints accepts tx: DocumentTransaction; { documentId, history }; item; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
/**
 * Upgrade pre-checkpoint native history before the first manual write changes its inference.
 * @param {DocumentTransaction} tx - Caller transaction retaining the family and document locks.
 * @param {string} ownerId - Owner of the conversation and its historical revisions.
 * @param {string} conversationId - Conversation whose missing turn snapshots are backfilled.
 * @param {readonly number[]} turns - Nonnegative native turn indexes that need durable snapshots.
 */
const backfillDocumentCheckpoints = async (
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

      if (revision) {
        return [
          {
            conversationId,
            documentId,
            ownerId,
            revisionId: revision.id,
            turnIndex,
          },
        ];
      }
      return [];
    });
    if (entries.length > 0) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Acquire and use transaction locks in a deterministic order.
      await tx.insert(eveDocumentCheckpointEntry).values(entries);
    }
  }
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve prepareManualRevision's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-params, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types */

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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve saveEveDocumentRevision's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null -- moving it below executable initialization can obscure ordering and API ownership.
max-lines-per-function (#510): saveEveDocumentRevision keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): saveEveDocumentRevision keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): saveEveDocumentRevision uses -1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/prefer-readonly-parameter-types (#565): saveEveDocumentRevision accepts value: z.input<typeof revisionInput>; signal?: AbortSignal; tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): saveEveDocumentRevision intentionally keeps the existing falsy-value behavior of conversation; replay; head; previous; distinguishing empty, zero, and absent states requires a domain behavior decision.
unicorn/no-null (#570): saveEveDocumentRevision preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
/**
 * Save a revision and move only this conversation's head, atomically and replay-safely.
 * @param {z.input<typeof revisionInput>} value - Revision payload with the expected head and immutable operation ID.
 * @param {AbortSignal | undefined} signal - Cancellation checked before admission and before transaction commit.
 * @param {readonly number[] | undefined} historicalTurns - Native turns to snapshot before a first manual revision.
 * @returns {Promise<typeof eveDocumentRevision.$inferSelect>} New revision or the persisted revision for an identical operation replay.
 */
const saveEveDocumentRevision = async (
  value: z.input<typeof revisionInput>,
  signal?: AbortSignal,
  historicalTurns?: readonly number[]
): Promise<typeof eveDocumentRevision.$inferSelect> => {
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading throwIfAborted from signal; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading throwIfAborted from signal; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading revisionId from head; preserve one receiver evaluation, skipped accesses and the existing null fallback. The app guidance prefers optional chaining.
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
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading throwIfAborted from signal; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading throwIfAborted from signal; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    signal?.throwIfAborted();
    return revision;
  });
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getEveDocumentHistory's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable typescript/strict-boolean-expressions -- moving it below executable initialization can obscure ordering and API ownership.
typescript/strict-boolean-expressions (#610): getEveDocumentHistory intentionally keeps the existing falsy-value behavior of head; distinguishing empty, zero, and absent states requires a domain behavior decision. */
/**
 * Traverse the selected revision's ancestry, never all revisions with the same document ID.
 * @param {string} ownerId - Owner authorized to inspect the selected conversation.
 * @param {string} conversationId - Conversation whose current document head selects ancestry.
 * @param {string} documentId - Document identity scoped to that conversation head.
 * @returns {Promise< Pick< typeof eveDocumentRevision.$inferSelect, "createdAt" | "id" | "kind" | "parentRevisionId" | "title" | "turnIndex" >[] >} Oldest-to-newest revision summaries, or no summaries when no head exists.
 */
const getEveDocumentHistory = async (
  ownerId: string,
  conversationId: string,
  documentId: string
): Promise<
  Pick<
    typeof eveDocumentRevision.$inferSelect,
    "createdAt" | "id" | "kind" | "parentRevisionId" | "title" | "turnIndex"
  >[]
> => {
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve inheritImportedDocumentCheckpoints's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/strict-boolean-expressions */

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
    // oxlint-disable-next-line oxc/no-map-spread, oxc/no-rest-spread-properties -- #541: Copy checkpoint rows into a new conversation or checkpoint without mutating source records. Rest/spread: Keep the existing header own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
      // oxlint-disable-next-line oxc/no-map-spread, oxc/no-rest-spread-properties -- #541: Copy checkpoint rows into a new conversation or checkpoint without mutating source records. Rest/spread: Keep the existing entry own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      .values(entries.map((entry) => ({ ...entry, conversationId })));
  }
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve initializeImportedForkDocuments's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable oxc/no-async-await */
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
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve inheritDocumentCheckpoints's awaited sequencing and rejected-Promise behavior. */
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
          // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing checkpoint own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
          // oxlint-disable-next-line oxc/no-map-spread, oxc/no-rest-spread-properties -- #541: Copy checkpoint rows into a new conversation or checkpoint without mutating source records. Rest/spread: Keep the existing entry own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
          .values(entries.map((entry) => ({ ...entry, conversationId })));
      }
    }
  }
  return inheritedCheckpoints;
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve initializeNamedForkDocuments's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve initializeEveForkDocuments's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-params, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- moving it below executable initialization can obscure ordering and API ownership.
max-lines-per-function (#510): initializeEveForkDocuments keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): initializeEveForkDocuments keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): initializeEveForkDocuments uses 13, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/prefer-readonly-parameter-types (#565): initializeEveForkDocuments accepts tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): initializeEveForkDocuments intentionally keeps the existing falsy-value behavior of target?.parentConversationId; target.forkMessageId; target.forkCheckpointId; distinguishing empty, zero, and absent states requires a domain behavior decision. */
/**
 * Call before exposing a newly bound fork; source edits after its boundary stay excluded.
 * @param {string} ownerId - Owner of the newly bound fork and its inherited snapshots.
 * @param {string} conversationId - Fork conversation whose native boundary selects source document heads.
 * @returns {Promise<void>} Completion after the fork document heads and inherited checkpoints are initialized.
 */
const initializeEveForkDocuments = async (
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
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading parentConversationId from target; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve captureEveDocumentCheckpoint's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- moving it below executable initialization can obscure ordering and API ownership.
no-magic-numbers (#517): captureEveDocumentCheckpoint uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/prefer-readonly-parameter-types (#565): captureEveDocumentCheckpoint accepts tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): captureEveDocumentCheckpoint intentionally keeps the existing falsy-value behavior of conversation; distinguishing empty, zero, and absent states requires a domain behavior decision. */
/**
 * Capture once before model execution; even an empty manifest is a durable checkpoint.
 * @param {string} ownerId - Owner of the bound conversation whose heads are captured.
 * @param {string} conversationId - Conversation that receives the immutable turn snapshot.
 * @param {number} turnIndex - Native turn boundary captured before model execution.
 */
const captureEveDocumentCheckpoint = async (
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
        // oxlint-disable-next-line oxc/no-map-spread, oxc/no-rest-spread-properties -- #541: Copy checkpoint rows into a new conversation or checkpoint without mutating source records. Rest/spread: Keep the existing head own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        .values(heads.map((head) => ({ ...head, turnIndex })));
    }
  });
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve captureEveNamedDocumentCheckpoint's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable max-lines-per-function, max-params, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- moving it below executable initialization can obscure ordering and API ownership.
max-lines-per-function (#510): captureEveNamedDocumentCheckpoint keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-params (#511): captureEveNamedDocumentCheckpoint keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): captureEveNamedDocumentCheckpoint keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): captureEveNamedDocumentCheckpoint uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/prefer-readonly-parameter-types (#565): captureEveNamedDocumentCheckpoint accepts tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): captureEveNamedDocumentCheckpoint intentionally keeps the existing falsy-value behavior of conversation; existing; distinguishing empty, zero, and absent states requires a domain behavior decision. */
/**
 * Native serialized capture calls this before publishing its named checkpoint.
 * @param {string} ownerId - Owner of the bound conversation and current document heads.
 * @param {string} conversationId - Conversation whose manifest the native checkpoint captures.
 * @param {string} checkpointId - Immutable native checkpoint UUID, reused only for the same turn.
 * @param {number} turnIndex - Native turn boundary associated with that checkpoint UUID.
 */
const captureEveNamedDocumentCheckpoint = async (
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
        // oxlint-disable-next-line oxc/no-map-spread, oxc/no-rest-spread-properties -- #541: Copy checkpoint rows into a new conversation or checkpoint without mutating source records. Rest/spread: Keep the existing head own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        .values(heads.map((head) => ({ ...head, checkpointId })));
    }
  });
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve readDocumentRevision's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-params, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/**
 * Internal only: the caller must first prove this revision belongs to the accessible ancestry.
 * @param {string} ownerId - Owner recorded on the authorized revision.
 * @param {string} documentId - Document identity expected by the ancestry lookup.
 * @param {string} revisionId - Selected revision whose content the caller is authorized to read.
 * @returns {Promise<typeof eveDocumentRevision.$inferSelect | undefined>} Persisted revision row, or no row when that exact owned revision is absent.
 */
const readDocumentRevision = async (
  ownerId: string,
  documentId: string,
  revisionId: string
): Promise<typeof eveDocumentRevision.$inferSelect | undefined> => {
  const revisions = await db
    .select()
    .from(eveDocumentRevision)
    .where(
      and(
        eq(eveDocumentRevision.id, revisionId),
        eq(eveDocumentRevision.ownerId, ownerId),
        eq(eveDocumentRevision.documentId, documentId)
      )
    );
  return revisions.at(FIRST_ROW_INDEX);
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getEveDocumentRevision's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-params, no-magic-numbers, typescript/strict-boolean-expressions -- max-params (#511): getEveDocumentRevision keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): getEveDocumentRevision uses -1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/strict-boolean-expressions (#610): getEveDocumentRevision intentionally keeps the existing falsy-value behavior of revisionId; distinguishing empty, zero, and absent states requires a domain behavior decision. */
/**
 * Content is loaded only for the selected, accessible revision.
 * @param {string} ownerId - Owner authorized to traverse the selected conversation ancestry.
 * @param {string} conversationId - Conversation whose current head scopes the history lookup.
 * @param {string} documentId - Document identity within that conversation.
 * @param {string | undefined} revisionId - Requested ancestor revision; omission or empty text selects the latest.
 * @returns {Promise<typeof eveDocumentRevision.$inferSelect | undefined>} Persisted revision content, or no revision when the selected ancestry is unavailable.
 */
const getEveDocumentRevision = async (
  ownerId: string,
  conversationId: string,
  documentId: string,
  revisionId?: string
): Promise<typeof eveDocumentRevision.$inferSelect | undefined> => {
  const history = await getEveDocumentHistory(
    ownerId,
    conversationId,
    documentId
  );
  const selected = revisionId
    ? history.find(
        (revision: ReadonlyNativeSurface<(typeof history)[number]>) =>
          revision.id === revisionId
      )
    : history.at(-1);
  if (!selected) {
    return;
  }
  // oxlint-disable-next-line typescript/consistent-return -- #580: getEveDocumentRevision has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
  return await readDocumentRevision(ownerId, documentId, selected.id);
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getAccessibleEveDocument's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-params, no-magic-numbers, typescript/strict-boolean-expressions */

/* oxlint-disable max-lines-per-function, max-params, max-statements, no-magic-numbers, no-undefined, typescript/strict-boolean-expressions -- max-lines-per-function (#510): getAccessibleEveDocument keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-params (#511): getAccessibleEveDocument keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): getAccessibleEveDocument keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): getAccessibleEveDocument uses -1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
no-undefined (#519): getAccessibleEveDocument uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
typescript/strict-boolean-expressions (#610): getAccessibleEveDocument intentionally keeps the existing falsy-value behavior of conversation; revisionId; current; distinguishing empty, zero, and absent states requires a domain behavior decision. */
/**
 * Public readers receive document content, never storage ownership or operation metadata.
 * @param {string | undefined} viewerId - Authenticated viewer, or no identity for a public reader.
 * @param {string} conversationId - Bound conversation whose visibility is checked before and after reading.
 * @param {string} documentId - Document identity scoped to that conversation ancestry.
 * @param {string | undefined} revisionId - Requested ancestor revision; omission or empty text selects the latest.
 * @returns {Promise< | { canEdit: boolean; history: Awaited<ReturnType<typeof getEveDocumentHistory>>; revision: Pick< typeof eveDocumentRevision.$inferSelect, "content" | "createdAt" | "documentId" | "id" | "kind" | "title" >; } | undefined >} Safe content and history with edit permission, or no result when access is unavailable.
 */
const getAccessibleEveDocument = async (
  viewerId: string | undefined,
  conversationId: string,
  documentId: string,
  revisionId?: string
): Promise<
  | {
      canEdit: boolean;
      history: Awaited<ReturnType<typeof getEveDocumentHistory>>;
      revision: Pick<
        typeof eveDocumentRevision.$inferSelect,
        "content" | "createdAt" | "documentId" | "id" | "kind" | "title"
      >;
    }
  | undefined
> => {
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
    ? history.find(
        (item: ReadonlyNativeSurface<(typeof history)[number]>) =>
          item.id === revisionId
      )
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve removeEveDocumentFromConversation's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-params, max-statements, no-magic-numbers, no-undefined, typescript/strict-boolean-expressions */

/* oxlint-disable max-lines-per-function, max-statements, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- max-lines-per-function (#510): removeEveDocumentFromConversation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): removeEveDocumentFromConversation keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
typescript/prefer-readonly-parameter-types (#565): removeEveDocumentFromConversation accepts input: { documentId: string; expectedRevisionId: string; title: string }; scope: { ownerId: string; conversationId: string }; signal: AbortSignal; tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): removeEveDocumentFromConversation intentionally keeps the existing falsy-value behavior of conversation; revision; head; distinguishing empty, zero, and absent states requires a domain behavior decision. */
/**
 * Remove only this conversation's current pointer; snapshots and other branches retain their revisions.
 * @param {{ documentId: string; expectedRevisionId: string; title: string }} input - Approved document identity, expected revision and title to recheck.
 * @param {{ ownerId: string; conversationId: string }} scope - Authorized conversation and owner receiving the pointer removal.
 * @param {AbortSignal} signal - Cancellation checked while the deletion transaction is locked.
 * @returns {Promise<{ documentId: string; result: string; status: "success"; title: string; }>} Successful removal metadata, including the revision title that was revalidated.
 */
const removeEveDocumentFromConversation = async (
  input: { documentId: string; expectedRevisionId: string; title: string },
  scope: { ownerId: string; conversationId: string },
  signal: AbortSignal
): Promise<{
  documentId: string;
  result: string;
  status: "success";
  title: string;
}> =>
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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (captureEveDocumentCheckpoint, captureEveNamedDocumentCheckpoint, getAccessibleEveDocument, getEveDocumentHistory, getEveDocumentRevision, initializeEveForkDocuments, purgeEveFamilyDocuments, removeEveDocumentFromConversation, saveEveDocumentRevision); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable max-lines -- #509: This eve-documents.ts module keeps its existing API and workflow boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric. */
export {
  captureEveDocumentCheckpoint,
  captureEveNamedDocumentCheckpoint,
  getAccessibleEveDocument,
  getEveDocumentHistory,
  getEveDocumentRevision,
  initializeEveForkDocuments,
  purgeEveFamilyDocuments,
  removeEveDocumentFromConversation,
  saveEveDocumentRevision,
};
/* oxlint-enable import/no-named-export */
