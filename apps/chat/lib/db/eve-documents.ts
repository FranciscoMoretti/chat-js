import { and, eq, inArray, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { artifactKinds } from "../artifacts/artifact-kind";
import { db } from "./client";
import { retainEveDocumentFiles } from "./eve-files";
import {
  eveConversation,
  eveDocumentCheckpoint,
  eveDocumentCheckpointEntry,
  eveDocumentHead,
  eveDocumentRevision,
  eveNamedDocumentCheckpoint,
  eveNamedDocumentCheckpointEntry,
} from "./schema";

const revisionInput = z.object({
  ownerId: z.string().min(1),
  conversationId: z.uuid(),
  documentId: z.uuid(),
  operationId: z.string().min(1).max(512),
  expectedRevisionId: z.uuid().nullable(),
  turnIndex: z.number().int().nonnegative().nullable(),
  title: z.string().min(1).max(1000),
  content: z.string().max(2_000_000),
  kind: z.enum(artifactKinds),
});

type DocumentTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Erase document rows after retirement and resource inventory have completed.
 * The deletion coordinator must retain file references before calling this.
 * This does not erase native history, blobs, metadata, or accounting, and never
 * marks the conversation deleted.
 */
export async function purgeEveFamilyDocuments(ownerId: string, rootId: string) {
  return await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${ownerId}`}, 0))`
    );
    const family = await tx
      .select({
        id: eveConversation.id,
        state: eveConversation.state,
        rootConversationId: eveConversation.rootConversationId,
      })
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.ownerId, ownerId),
          or(
            eq(eveConversation.id, rootId),
            eq(eveConversation.rootConversationId, rootId)
          )
        )
      )
      .orderBy(eveConversation.id);
    if (
      !family.some((row) => row.id === rootId && !row.rootConversationId) ||
      family.some((row) => row.state !== "deleting")
    ) {
      throw new Error(
        "The entire conversation family must be pending deletion."
      );
    }
    const ids = family.map((row) => row.id);
    for (const id of ids) {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`eve-document:${id}`}, 0))`
      );
    }
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
}

/** Upgrade pre-checkpoint native history before the first manual write changes its inference. */
async function backfillDocumentCheckpoints(
  tx: DocumentTransaction,
  ownerId: string,
  conversationId: string,
  turns: readonly number[]
) {
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
  if (!missing.length) {
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
              ownerId,
              turnIndex,
              documentId,
              revisionId: revision.id,
            },
          ]
        : [];
    });
    if (entries.length) {
      await tx.insert(eveDocumentCheckpointEntry).values(entries);
    }
  }
}

/** Save a revision and move only this conversation's head, atomically and replay-safely. */
export async function saveEveDocumentRevision(
  value: z.input<typeof revisionInput>,
  signal?: AbortSignal,
  historicalTurns?: readonly number[]
) {
  signal?.throwIfAborted();
  const input = revisionInput.parse(value);
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
      input.content
    );
    await prepareManualRevision(tx, input, historicalTurns);
    signal?.throwIfAborted();
    const [revision] = await tx
      .insert(eveDocumentRevision)
      .values({
        ownerId: input.ownerId,
        conversationId: input.conversationId,
        documentId: input.documentId,
        operationId: input.operationId,
        parentRevisionId: input.expectedRevisionId,
        turnIndex: input.turnIndex,
        title: input.title,
        content: input.content,
        kind: input.kind,
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
        target: [eveDocumentHead.conversationId, eveDocumentHead.documentId],
        set: { revisionId: revision.id },
      });
    signal?.throwIfAborted();
    return revision;
  });
}

/** Traverse the selected revision's ancestry, never all revisions with the same document ID. */
export async function getEveDocumentHistory(
  ownerId: string,
  conversationId: string,
  documentId: string
) {
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
      id: eveDocumentRevision.id,
      parentRevisionId: eveDocumentRevision.parentRevisionId,
      title: eveDocumentRevision.title,
      kind: eveDocumentRevision.kind,
      turnIndex: eveDocumentRevision.turnIndex,
      createdAt: eveDocumentRevision.createdAt,
    })
    .from(eveDocumentRevision)
    .where(
      inArray(
        eveDocumentRevision.id,
        ancestorIds(ownerId, documentId, head.revisionId)
      )
    );
  return orderRevisionHistory(revisions, head.revisionId);
}

/** Call before exposing a newly bound fork; source edits after its boundary stay excluded. */
export async function initializeEveForkDocuments(
  ownerId: string,
  conversationId: string
) {
  return await db.transaction(async (tx) => {
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
    if (!(target?.parentConversationId && target.forkTurnId)) {
      throw new Error("Fork conversation not found.");
    }
    const beforeTurn = parseForkTurnIndex(target.forkTurnId);
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-document:${target.parentConversationId}`}, 0))`
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
      if (entries.length) {
        await tx
          .insert(eveDocumentHead)
          .values(
            entries.map((entry) => ({
              conversationId,
              ownerId,
              documentId: entry.documentId,
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
}

/** Capture once before model execution; even an empty manifest is a durable checkpoint. */
export async function captureEveDocumentCheckpoint(
  ownerId: string,
  conversationId: string,
  turnIndex: number
) {
  z.number().int().nonnegative().parse(turnIndex);
  return await db.transaction(async (tx) => {
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
      .values({ ownerId, conversationId, turnIndex })
      .onConflictDoNothing()
      .returning();
    if (!inserted.length) {
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
    if (heads.length) {
      await tx
        .insert(eveDocumentCheckpointEntry)
        .values(heads.map((head) => ({ ...head, turnIndex })));
    }
  });
}

/** Native serialized capture calls this before publishing its named checkpoint. */
export async function captureEveNamedDocumentCheckpoint(
  ownerId: string,
  conversationId: string,
  checkpointId: string,
  turnIndex: number
) {
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
      .values({ ownerId, conversationId, checkpointId, turnIndex });
    const heads = await tx
      .select()
      .from(eveDocumentHead)
      .where(
        and(
          eq(eveDocumentHead.conversationId, conversationId),
          eq(eveDocumentHead.ownerId, ownerId)
        )
      );
    if (heads.length) {
      await tx
        .insert(eveNamedDocumentCheckpointEntry)
        .values(heads.map((head) => ({ ...head, checkpointId })));
    }
  });
}

/** Content is loaded only for the selected, accessible revision. */
export async function getEveDocumentRevision(
  ownerId: string,
  conversationId: string,
  documentId: string,
  revisionId?: string
) {
  const history = await getEveDocumentHistory(
    ownerId,
    conversationId,
    documentId
  );
  const selected = revisionId
    ? history.find((revision) => revision.id === revisionId)
    : history.at(-1);
  if (!selected) {
    return undefined;
  }
  return await readDocumentRevision(ownerId, documentId, selected.id);
}

/** Internal only: the caller must first prove this revision belongs to the accessible ancestry. */
async function readDocumentRevision(
  ownerId: string,
  documentId: string,
  revisionId: string
) {
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
}

function ancestorIds(ownerId: string, documentId: string, headId: string) {
  return sql`(with recursive ancestry as (
    select "id", "parentRevisionId" from "EveDocumentRevision" where "id" = ${headId} and "ownerId" = ${ownerId} and "documentId" = ${documentId}
    union
    select revision."id", revision."parentRevisionId" from "EveDocumentRevision" revision join ancestry on revision."id" = ancestry."parentRevisionId"
  ) select "id" from ancestry)`;
}

/** Public readers receive document content, never storage ownership or operation metadata. */
export async function getAccessibleEveDocument(
  viewerId: string | undefined,
  conversationId: string,
  documentId: string,
  revisionId?: string
) {
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
    return undefined;
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
    return undefined;
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
    return undefined;
  }
  return {
    canEdit: current.ownerId === viewerId,
    history,
    revision: {
      id: revision.id,
      documentId: revision.documentId,
      title: revision.title,
      kind: revision.kind,
      content: revision.content,
      createdAt: revision.createdAt,
    },
  };
}

function orderRevisionHistory<
  T extends { id: string; parentRevisionId: string | null },
>(revisions: T[], headId: string) {
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
  return history.reverse();
}

async function inheritDocumentCheckpoints(
  tx: DocumentTransaction,
  ownerId: string,
  sourceId: string,
  conversationId: string,
  beforeTurn: number
) {
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
  if (inheritedCheckpoints.length) {
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
    if (copied.length) {
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
      if (entries.length) {
        await tx
          .insert(eveDocumentCheckpointEntry)
          .values(entries.map((entry) => ({ ...entry, conversationId })));
      }
    }
  }

  return inheritedCheckpoints;
}

async function prepareManualRevision(
  tx: DocumentTransaction,
  input: z.infer<typeof revisionInput>,
  historicalTurns?: readonly number[]
) {
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
}

async function initializeNamedForkDocuments(
  tx: DocumentTransaction,
  ownerId: string,
  conversationId: string,
  sourceId: string,
  checkpointId: string,
  beforeTurn: number
) {
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
  if (entries.length) {
    await tx
      .insert(eveDocumentHead)
      .values(
        entries.map((entry) => ({
          ownerId,
          conversationId,
          documentId: entry.documentId,
          revisionId: entry.revisionId,
        }))
      )
      .onConflictDoNothing();
  }
}

function parseForkTurnIndex(turnId: string) {
  const turnIndex = Number(turnId.slice("turn_".length));
  if (!Number.isSafeInteger(turnIndex) || turnIndex < 0) {
    throw new Error("Invalid fork boundary.");
  }
  return turnIndex;
}
