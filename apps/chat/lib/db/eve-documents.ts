import { and, eq, inArray, lt, lte, or, sql } from "drizzle-orm";
import type { EveCopyBoundary } from "@/lib/eve/copy-boundaries";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import type { SQL } from "drizzle-orm";
import { z } from "zod";

import { artifactKinds } from "@/lib/artifacts/artifact-kind";
import { documentFileIds } from "@/lib/eve/document-contracts";
import { isFileStorageKey } from "@/lib/file-url";

import { db } from "./client";
import {
  eveConversation,
  eveDocumentCheckpoint,
  eveDocumentCheckpointEntry,
  eveDocumentHead,
  eveDocumentRevision,
  eveFileReference,
  eveImportedDocumentCheckpoint,
  eveImportedDocumentCheckpointEntry,
  eveNamedDocumentCheckpoint,
  eveNamedDocumentCheckpointEntry,
  eveStoredFile,
} from "./schema";

const FIRST_ROW_INDEX = 0;
const FIRST_TURN_INDEX = 0;
const MINIMUM_TEXT_LENGTH = 1;
const MAXIMUM_CONTENT_LENGTH = 2_000_000;
const MAXIMUM_OPERATION_ID_LENGTH = 512;
const MAXIMUM_TITLE_LENGTH = 1000;

const revisionInput = z.object({
  content: z.string().max(MAXIMUM_CONTENT_LENGTH),
  conversationId: z.uuid(),
  documentId: z.uuid(),
  expectedRevisionId: z.uuid().nullable(),
  fileIds: documentFileIds,
  kind: z.enum(artifactKinds),
  operationId: z
    .string()
    .min(MINIMUM_TEXT_LENGTH)
    .max(MAXIMUM_OPERATION_ID_LENGTH),
  ownerId: z.string().min(MINIMUM_TEXT_LENGTH),
  title: z.string().min(MINIMUM_TEXT_LENGTH).max(MAXIMUM_TITLE_LENGTH),
  turnIndex: z.number().int().nonnegative().nullable(),
});

type DocumentTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Native transaction methods shared by locked document write operations.
type DocumentWriteTransaction = Readonly<
  Pick<DocumentTransaction, "execute" | "insert" | "select">
>;

/**
 * Caller holds the owner family lock and has authorized the document revision.
 * @param {DocumentTransaction} tx - Caller transaction holding the owner family lock.
 * @param {string} ownerId - Owner required for every active document file.
 * @param {string} conversationId - Conversation that retains the document references.
 * @param {readonly string[]} fileIds - Storage keys referenced by the authorized revision.
 */
const retainEveDocumentFiles = async (
  tx: Readonly<Pick<DocumentTransaction, "insert" | "select">>,
  ownerId: string,
  conversationId: string,
  fileIds: readonly string[]
): Promise<void> => {
  const candidates = [...new Set(fileIds)];
  if (candidates.some((id) => !isFileStorageKey(id))) {
    throw new Error("Invalid document file reference.");
  }
  if (candidates.length === 0) {
    return;
  }
  const files = await tx
    .select({ key: eveStoredFile.key })
    .from(eveStoredFile)
    .where(
      and(
        eq(eveStoredFile.ownerId, ownerId),
        eq(eveStoredFile.state, "active"),
        inArray(eveStoredFile.key, candidates)
      )
    );
  if (files.length !== candidates.length) {
    throw new Error("Document references an unavailable or unowned file.");
  }
  await tx
    .insert(eveFileReference)
    .values(files.map(({ key }) => ({ conversationId, key, ownerId })))
    .onConflictDoNothing();
};

const snapshotCopyCheckpoints = async (
  tx: Readonly<Pick<DocumentTransaction, "select">>,
  input: ReadonlyNativeSurface<{
    readonly conversationId: string;
    readonly ownerId: string;
    readonly documentIds: readonly string[];
    readonly boundaries: readonly EveCopyBoundary[];
    readonly byId: ReadonlyMap<
      string,
      {
        readonly documentId: string;
      }
    >;
  }>
): Promise<
  {
    heads: { documentId: string; revisionId: string }[];
    messageIndex: number;
  }[]
> => {
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
    .filter((boundary: EveCopyBoundary) => boundary.sourceKind === "turn")
    .map((boundary: EveCopyBoundary) => boundary.sourceIndex);
  const imported = boundaries
    .filter((boundary: EveCopyBoundary) => boundary.sourceKind === "imported")
    .map((boundary: EveCopyBoundary) => boundary.sourceIndex);
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
  const checkpoints = boundaries.map((boundary: EveCopyBoundary) => {
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
      heads: heads.toSorted(
        (
          leftHead: Readonly<{ documentId: string; revisionId: string }>,
          rightHead: Readonly<{ documentId: string; revisionId: string }>
        ) => leftHead.documentId.localeCompare(rightHead.documentId)
      ),
      messageIndex: boundary.messageIndex,
    };
  });
  return checkpoints;
};

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
): Promise<void> => {
  await db.transaction(
    async (
      tx: Readonly<Pick<DocumentTransaction, "delete" | "execute" | "select">>
    ) => {
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
      if (
        family.length === 0 ||
        family.some((row) => row.state !== "deleting")
      ) {
        throw new Error(
          "The entire conversation family must be pending deletion."
        );
      }
      const ids = family.map((row) => row.id);
      for (const id of ids) {
        // oxlint-disable-next-line eslint/no-await-in-loop -- Acquire each family document advisory lock before deleting checkpoint rows; document writers retain those locks through commit.
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
    }
  );
};

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

const orderRevisionHistory = <
  Revision extends {
    readonly id: string;
    readonly parentRevisionId: string | null;
  },
>(
  revisions: readonly Revision[],
  headId: string
): Revision[] => {
  const byId = new Map(revisions.map((revision) => [revision.id, revision]));
  const history: Revision[] = [];
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

/**
 * Upgrade pre-checkpoint native history before the first manual write changes its inference.
 * @param {DocumentTransaction} tx - Caller transaction retaining the family and document locks.
 * @param {string} ownerId - Owner of the conversation and its historical revisions.
 * @param {string} conversationId - Conversation whose missing turn snapshots are backfilled.
 * @param {readonly number[]} turns - Nonnegative native turn indexes that need durable snapshots.
 */
const backfillDocumentCheckpoints = async (
  tx: Readonly<Pick<DocumentTransaction, "insert" | "select">>,
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
  const revisions =
    heads.length > 0
      ? await tx
          .select({
            documentId: eveDocumentRevision.documentId,
            id: eveDocumentRevision.id,
            parentRevisionId: eveDocumentRevision.parentRevisionId,
            turnIndex: eveDocumentRevision.turnIndex,
          })
          .from(eveDocumentRevision)
          .where(
            or(
              ...heads.map((head) =>
                inArray(
                  eveDocumentRevision.id,
                  ancestorIds(ownerId, head.documentId, head.revisionId)
                )
              )
            )
          )
      : [];
  const revisionsByDocument = new Map<string, typeof revisions>();
  for (const revision of revisions) {
    const history = revisionsByDocument.get(revision.documentId);
    if (history) {
      history.push(revision);
    } else {
      revisionsByDocument.set(revision.documentId, [revision]);
    }
  }
  const histories = heads.map((head) => {
    const history = orderRevisionHistory(
      revisionsByDocument.get(head.documentId) ?? [],
      head.revisionId
    );
    if (history.some((revision) => revision.turnIndex === null)) {
      throw new Error(
        "Document checkpoint is not ready. Retry saving shortly."
      );
    }
    return { documentId: head.documentId, history };
  });
  await tx
    .insert(eveDocumentCheckpoint)
    .values(
      missing.map((turnIndex) => ({ conversationId, ownerId, turnIndex }))
    );
  for (const turnIndex of missing) {
    const entries = histories.flatMap(
      ({
        documentId,
        history,
      }: Readonly<{
        readonly documentId: string;
        readonly history: readonly {
          readonly id: string;
          readonly parentRevisionId: string | null;
          readonly turnIndex: number | null;
        }[];
      }>) => {
        const revision = history.findLast(
          (item: Readonly<(typeof history)[number]>) =>
            item.turnIndex !== null && item.turnIndex < turnIndex
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
      }
    );
    if (entries.length > 0) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Headers are already inserted; write one turn's manifest at a time instead of retaining entries for every missing turn times every document.
      await tx.insert(eveDocumentCheckpointEntry).values(entries);
    }
  }
};

const prepareManualRevision = async (
  tx: Readonly<Pick<DocumentTransaction, "insert" | "select">>,
  input: ReadonlyNativeSurface<z.infer<typeof revisionInput>>,
  historicalTurns?: readonly number[]
): Promise<void> => {
  if (input.turnIndex === null) {
    if (
      !(
        input.expectedRevisionId !== null &&
        input.expectedRevisionId !== "" &&
        historicalTurns
      )
    ) {
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

const assertRevisionReplay = (
  replay: typeof eveDocumentRevision.$inferSelect,
  input: z.infer<typeof revisionInput>
): void => {
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
};

/**
 * Save a revision and move only this conversation's head, atomically and replay-safely.
 * @param {z.input<typeof revisionInput>} value - Revision payload with the expected head and immutable operation ID.
 * @param {AbortSignal | undefined} signal - Cancellation checked before admission and before transaction commit.
 * @param {readonly number[] | undefined} historicalTurns - Native turns to snapshot before a first manual revision.
 * @returns {Promise<typeof eveDocumentRevision.$inferSelect>} New revision or the persisted revision for an identical operation replay.
 */
const saveEveDocumentRevision = async (
  value: ReadonlyNativeSurface<z.input<typeof revisionInput>>,
  signal?: ReadonlyNativeSurface<AbortSignal>,
  historicalTurns?: readonly number[]
): Promise<typeof eveDocumentRevision.$inferSelect> => {
  if (signal) {
    signal.throwIfAborted();
  }
  const input = revisionInput.parse(value);
  return await db.transaction(async (tx: DocumentWriteTransaction) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${input.ownerId}`}, 0))`
    );
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-document:${input.conversationId}`}, 0))`
    );
    if (signal) {
      signal.throwIfAborted();
    }
    const conversationRows = await tx
      .select()
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.id, input.conversationId),
          eq(eveConversation.ownerId, input.ownerId),
          eq(eveConversation.state, "bound")
        )
      );
    const conversation = conversationRows.at(FIRST_ROW_INDEX);
    if (!conversation) {
      throw new Error("Conversation not found.");
    }
    const replayRows = await tx
      .select()
      .from(eveDocumentRevision)
      .where(
        and(
          eq(eveDocumentRevision.conversationId, input.conversationId),
          eq(eveDocumentRevision.operationId, input.operationId)
        )
      );
    const replay = replayRows.at(FIRST_ROW_INDEX);
    if (replay) {
      assertRevisionReplay(replay, input);
      return replay;
    }
    const headRows = await tx
      .select()
      .from(eveDocumentHead)
      .where(
        and(
          eq(eveDocumentHead.conversationId, input.conversationId),
          eq(eveDocumentHead.documentId, input.documentId)
        )
      );
    const head = headRows.at(FIRST_ROW_INDEX);
    if ((head?.revisionId ?? null) !== input.expectedRevisionId) {
      throw new Error("Document changed. Reload before saving.");
    }
    if (head) {
      const previousRows = await tx
        .select()
        .from(eveDocumentRevision)
        .where(eq(eveDocumentRevision.id, head.revisionId));
      const previous = previousRows.at(FIRST_ROW_INDEX);
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
    if (signal) {
      signal.throwIfAborted();
    }
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
    if (signal) {
      signal.throwIfAborted();
    }
    return revision;
  });
};

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
  const headRows = await db
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
  const head = headRows.at(FIRST_ROW_INDEX);
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

const inheritImportedDocumentCheckpoints = async (
  tx: Readonly<Pick<DocumentTransaction, "insert" | "select">>,
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
      .values(entries.map((entry) => ({ ...entry, conversationId })));
  }
};

const initializeImportedForkDocuments = async (
  tx: Readonly<Pick<DocumentTransaction, "insert" | "select">>,
  ownerId: string,
  sourceId: string,
  conversationId: string,
  messageIndex: number
): Promise<void> => {
  const checkpointRows = await tx
    .select()
    .from(eveImportedDocumentCheckpoint)
    .where(
      and(
        eq(eveImportedDocumentCheckpoint.conversationId, sourceId),
        eq(eveImportedDocumentCheckpoint.ownerId, ownerId),
        eq(eveImportedDocumentCheckpoint.messageIndex, messageIndex)
      )
    );
  const checkpoint = checkpointRows.at(FIRST_ROW_INDEX);
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

const parseForkTurnIndex = (turnId: string): number => {
  const turnIndex = Number(turnId.slice("turn_".length));
  if (!Number.isSafeInteger(turnIndex) || turnIndex < FIRST_TURN_INDEX) {
    throw new Error("Invalid fork boundary.");
  }
  return turnIndex;
};

const inheritDocumentCheckpoints = async (
  tx: Readonly<Pick<DocumentTransaction, "insert" | "select">>,
  ownerId: string,
  sourceId: string,
  conversationId: string,
  beforeTurn: number
): Promise<(typeof eveDocumentCheckpoint.$inferSelect)[]> => {
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
          .values(entries.map((entry) => ({ ...entry, conversationId })));
      }
    }
  }
  return inheritedCheckpoints;
};

const initializeNamedForkDocuments = async (
  tx: Readonly<Pick<DocumentTransaction, "insert" | "select">>,
  ownerId: string,
  conversationId: string,
  sourceId: string,
  checkpointId: string,
  beforeTurn: number
): Promise<void> => {
  const checkpointRows = await tx
    .select()
    .from(eveNamedDocumentCheckpoint)
    .where(
      and(
        eq(eveNamedDocumentCheckpoint.ownerId, ownerId),
        eq(eveNamedDocumentCheckpoint.conversationId, sourceId),
        eq(eveNamedDocumentCheckpoint.checkpointId, checkpointId)
      )
    );
  const checkpoint = checkpointRows.at(FIRST_ROW_INDEX);
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

/**
 * Call before exposing a newly bound fork; source edits after its boundary stay excluded.
 * @param {string} ownerId - Owner of the newly bound fork and its inherited snapshots.
 * @param {string} conversationId - Fork conversation whose native boundary selects source document heads.
 * @returns {Promise<void>} Completion after the fork document heads and inherited checkpoints are initialized.
 */
const initializeEveForkDocuments = async (
  ownerId: string,
  conversationId: string
): Promise<void> => {
  await db.transaction(async (tx: DocumentWriteTransaction) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-document:${conversationId}`}, 0))`
    );
    const targetRows = await tx
      .select()
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.id, conversationId),
          eq(eveConversation.ownerId, ownerId)
        )
      );
    const target = targetRows.at(FIRST_ROW_INDEX);
    if (
      !target ||
      target.parentConversationId === null ||
      target.parentConversationId === ""
    ) {
      throw new Error("Fork conversation not found.");
    }
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-document:${target.parentConversationId}`}, 0))`
    );
    if (target.forkMessageId !== null && target.forkMessageId !== "") {
      await initializeImportedForkDocuments(
        tx,
        ownerId,
        target.parentConversationId,
        conversationId,
        Number(target.forkMessageId.slice("seed_message_".length))
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
    if (target.forkCheckpointId !== null && target.forkCheckpointId !== "") {
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
    const inheritedHeads: (typeof eveDocumentHead.$inferInsert)[] = [];
    for (const head of heads) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Legacy fork inference reads only one document's ancestry at a time; loading all document histories together would increase peak memory before selecting the pre-turn heads.
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
        inheritedHeads.push({
          conversationId,
          documentId: head.documentId,
          ownerId,
          revisionId: selectedRevision.id,
        });
      }
    }
    if (inheritedHeads.length > 0) {
      await tx
        .insert(eveDocumentHead)
        .values(inheritedHeads)
        .onConflictDoNothing();
    }
  });
};

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
  await db.transaction(async (tx: DocumentWriteTransaction) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-document:${conversationId}`}, 0))`
    );
    const conversationRows = await tx
      .select({ id: eveConversation.id })
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.id, conversationId),
          eq(eveConversation.ownerId, ownerId),
          eq(eveConversation.state, "bound")
        )
      );

    if (conversationRows.length === 0) {
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
        .values(heads.map((head) => ({ ...head, turnIndex })));
    }
  });
};

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
  await db.transaction(async (tx: DocumentWriteTransaction) => {
    // Coordinate with deletion as well as manual/model document writes.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${ownerId}`}, 0))`
    );
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-document:${conversationId}`}, 0))`
    );
    const conversationRows = await tx
      .select({ id: eveConversation.id })
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.id, conversationId),
          eq(eveConversation.ownerId, ownerId),
          eq(eveConversation.state, "bound")
        )
      );
    const conversation = conversationRows.at(FIRST_ROW_INDEX);
    if (!conversation) {
      throw new Error("Conversation not found.");
    }
    const existingRows = await tx
      .select()
      .from(eveNamedDocumentCheckpoint)
      .where(
        and(
          eq(eveNamedDocumentCheckpoint.conversationId, conversationId),
          eq(eveNamedDocumentCheckpoint.checkpointId, checkpointId),
          eq(eveNamedDocumentCheckpoint.ownerId, ownerId)
        )
      );
    const existing = existingRows.at(FIRST_ROW_INDEX);
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
        .values(heads.map((head) => ({ ...head, checkpointId })));
    }
  });
};

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
  const selected =
    (revisionId ?? "") === ""
      ? history.at(-1)
      : history.find(
          (revision: ReadonlyNativeSurface<(typeof history)[number]>) =>
            revision.id === revisionId
        );
  if (!selected) {
    return undefined;
  }
  return await readDocumentRevision(ownerId, documentId, selected.id);
};

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
  const conversationRows = await db
    .select()
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.id, conversationId),
        eq(eveConversation.state, "bound")
      )
    );
  const conversation = conversationRows.at(FIRST_ROW_INDEX);
  if (
    !conversation ||
    (conversation.ownerId !== viewerId && conversation.visibility !== "public")
  ) {
    return undefined;
  }
  const history = await getEveDocumentHistory(
    conversation.ownerId,
    conversationId,
    documentId
  );
  const selected =
    (revisionId ?? "") === ""
      ? history.at(-1)
      : history.find(
          (item: ReadonlyNativeSurface<(typeof history)[number]>) =>
            item.id === revisionId
        );
  const revision = selected
    ? await readDocumentRevision(conversation.ownerId, documentId, selected.id)
    : undefined;
  if (!revision) {
    return undefined;
  }
  // Recheck visibility after the potentially slow ancestry/content read.
  const currentRows = await db
    .select()
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.id, conversationId),
        eq(eveConversation.state, "bound")
      )
    );
  const current = currentRows.at(FIRST_ROW_INDEX);
  if (
    !current ||
    (current.ownerId !== viewerId && current.visibility !== "public")
  ) {
    return undefined;
  }
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

/**
 * Remove only this conversation's current pointer; snapshots and other branches retain their revisions.
 * @param {{ documentId: string; expectedRevisionId: string; title: string }} input - Approved document identity, expected revision and title to recheck.
 * @param {{ ownerId: string; conversationId: string }} scope - Authorized conversation and owner receiving the pointer removal.
 * @param {AbortSignal} signal - Cancellation checked while the deletion transaction is locked.
 * @returns {Promise<{ documentId: string; result: string; status: "success"; title: string; }>} Successful removal metadata, including the revision title that was revalidated.
 */
const removeEveDocumentFromConversation = async (
  input: Readonly<{
    documentId: string;
    expectedRevisionId: string;
    title: string;
  }>,
  scope: Readonly<{ ownerId: string; conversationId: string }>,
  signal: ReadonlyNativeSurface<AbortSignal>
): Promise<{
  documentId: string;
  result: string;
  status: "success";
  title: string;
}> =>
  await db.transaction(
    async (
      tx: Readonly<Pick<DocumentTransaction, "delete" | "execute" | "select">>
    ) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${scope.ownerId}`}, 0))`
      );
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`eve-document:${scope.conversationId}`}, 0))`
      );
      signal.throwIfAborted();
      const conversationRows = await tx
        .select()
        .from(eveConversation)
        .where(
          and(
            eq(eveConversation.id, scope.conversationId),
            eq(eveConversation.ownerId, scope.ownerId),
            eq(eveConversation.state, "bound")
          )
        );
      const conversation = conversationRows.at(FIRST_ROW_INDEX);
      if (!conversation) {
        throw new Error("Conversation not found.");
      }
      const revisionRows = await tx
        .select()
        .from(eveDocumentRevision)
        .where(
          and(
            eq(eveDocumentRevision.id, input.expectedRevisionId),
            eq(eveDocumentRevision.documentId, input.documentId),
            eq(eveDocumentRevision.ownerId, scope.ownerId)
          )
        );
      const revision = revisionRows.at(FIRST_ROW_INDEX);
      if (!revision) {
        throw new Error("Document not found.");
      }
      if (revision.title !== input.title) {
        throw new Error("Document changed. Request approval again.");
      }
      const headRows = await tx
        .select()
        .from(eveDocumentHead)
        .where(
          and(
            eq(eveDocumentHead.conversationId, scope.conversationId),
            eq(eveDocumentHead.documentId, input.documentId),
            eq(eveDocumentHead.ownerId, scope.ownerId)
          )
        );
      const head = headRows.at(FIRST_ROW_INDEX);
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
    }
  );

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
  snapshotCopyCheckpoints,
};
