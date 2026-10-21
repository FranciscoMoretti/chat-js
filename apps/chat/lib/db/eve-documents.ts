import { eveDeletionScope } from "./eve-deletion-scope";
import { unretainedEveDocumentRevisionIds } from "./eve-document-retention";
import { isNonEmptyString } from "@/lib/is-non-empty-string";
import { and, eq, inArray, sql } from "drizzle-orm";
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
            eveDeletionScope(ownerId, rootId)
          )
        )
        .orderBy(eveConversation.id);
      if (
        family.length === 0 ||
        family.some(
          (row) => row.state !== "deleting" && row.state !== "deleted"
        )
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
      // Remove this member's pointers before computing surviving ancestry.
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
            inArray(
              eveDocumentRevision.id,
              unretainedEveDocumentRevisionIds(ownerId, ids)
            )
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
 * @returns {Promise<typeof eveDocumentRevision.$inferSelect>} New revision or the persisted revision for an identical operation replay.
 */
const saveEveDocumentRevision = async (
  value: ReadonlyNativeSurface<z.input<typeof revisionInput>>,
  signal?: ReadonlyNativeSurface<AbortSignal>
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
    if (
      input.turnIndex === null &&
      !isNonEmptyString(input.expectedRevisionId)
    ) {
      throw new Error("Manual edits require an existing document.");
    }
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
 * @param {Pick<typeof db, "select">} reader - Existing transaction when capturing a consistent fork; defaults to the database.
 * @returns {Promise< Pick< typeof eveDocumentRevision.$inferSelect, "createdAt" | "id" | "kind" | "parentRevisionId" | "title" | "turnIndex" >[] >} Oldest-to-newest revision summaries, or no summaries when no head exists.
 */
const getEveDocumentHistory = async (
  ownerId: string,
  conversationId: string,
  documentId: string,
  reader: Pick<typeof db, "select"> = db
): Promise<
  Pick<
    typeof eveDocumentRevision.$inferSelect,
    "createdAt" | "id" | "kind" | "parentRevisionId" | "title" | "turnIndex"
  >[]
> => {
  const headRows = await reader
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
  const revisions = await reader
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

const readDocumentRevision = async (
  ownerId: string,
  documentId: string,
  revisionId: string
): Promise<typeof eveDocumentRevision.$inferSelect | null> => {
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
  return revisions.at(FIRST_ROW_INDEX) ?? null;
};
/**
 * Content is loaded only for the selected, accessible revision.
 * @param {string} ownerId - Owner authorized to traverse the selected conversation ancestry.
 * @param {string} conversationId - Conversation whose current head scopes the history lookup.
 * @param {string} documentId - Document identity within that conversation.
 * @param {string | undefined} revisionId - Requested ancestor revision; omission or empty text selects the latest.
 * @returns {Promise<typeof eveDocumentRevision.$inferSelect | null>} Persisted revision content, or no revision when the selected ancestry is unavailable.
 */
const getEveDocumentRevision = async (
  ownerId: string,
  conversationId: string,
  documentId: string,
  revisionId?: string
): Promise<typeof eveDocumentRevision.$inferSelect | null> => {
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
    return null;
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
  getAccessibleEveDocument,
  getEveDocumentHistory,
  getEveDocumentRevision,
  purgeEveFamilyDocuments,
  removeEveDocumentFromConversation,
  saveEveDocumentRevision,
};
