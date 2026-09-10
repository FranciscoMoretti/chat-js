import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { artifactKinds } from "../artifacts/artifact-kind";
import { db } from "./client";
import {
  eveConversation,
  eveDocumentHead,
  eveDocumentRevision,
} from "./schema";

const revisionInput = z.object({
  ownerId: z.string().min(1),
  conversationId: z.uuid(),
  documentId: z.uuid(),
  operationId: z.string().min(1).max(512),
  expectedRevisionId: z.uuid().nullable(),
  turnIndex: z.number().int().nonnegative(),
  title: z.string().min(1).max(1000),
  content: z.string().max(2_000_000),
  kind: z.enum(artifactKinds),
});

/** Save a revision and move only this conversation's head, atomically and replay-safely. */
export async function saveEveDocumentRevision(
  value: z.input<typeof revisionInput>,
  signal?: AbortSignal
) {
  signal?.throwIfAborted();
  const input = revisionInput.parse(value);
  return await db.transaction(async (tx) => {
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
        previous.turnIndex > input.turnIndex
      ) {
        throw new Error("Invalid document revision.");
      }
    }
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
    const beforeTurn = Number(target.forkTurnId.slice("turn_".length));
    if (!Number.isSafeInteger(beforeTurn) || beforeTurn < 0) {
      throw new Error("Invalid fork boundary.");
    }
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
      const revision = orderRevisionHistory(
        ancestors,
        head.revisionId
      ).findLast((version) => version.turnIndex < beforeTurn);
      if (revision) {
        await tx
          .insert(eveDocumentHead)
          .values({
            conversationId,
            documentId: head.documentId,
            ownerId,
            revisionId: revision.id,
          })
          .onConflictDoNothing();
      }
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
