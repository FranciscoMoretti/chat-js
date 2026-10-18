import { isNonEmptyString } from "@/lib/is-non-empty-string";
import { and, eq, sql } from "drizzle-orm";
import { db } from "./client";
import {
  eveConversation,
  eveDispatch,
  eveDocumentHead,
  eveFileReference,
} from "./schema";
import { getEveMessageDisplayReceipts } from "./eve-dispatch";
import { readCompletedEveCopyTranscript } from "@/lib/eve/completed-copy-source";
import { parseEveCopySeed } from "@/lib/eve/copy-seed";

/** Capture current completed history and owned resources once, before native dispatch. */
export const initializeEveCurrentCopy = async (
  ownerId: string,
  conversationId: string
): Promise<void> => {
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${ownerId}`}, 0))`
    );
    const [target] = await tx
      .select()
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.id, conversationId),
          eq(eveConversation.ownerId, ownerId)
        )
      )
      .for("update");
    if (
      !isNonEmptyString(target?.parentConversationId) ||
      !["creating", "uncertain"].includes(target.state)
    ) {
      throw new Error("Copy conversation not found.");
    }
    if (target.initialSeed !== null) {
      return;
    }
    const [source] = await tx
      .select()
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.id, target.parentConversationId),
          eq(eveConversation.ownerId, ownerId),
          eq(eveConversation.state, "bound")
        )
      )
      .for("share");
    if (!isNonEmptyString(source?.sessionId)) {
      throw new Error("Source conversation not found.");
    }
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-document:${source.id}`}, 0))`
    );
    const dispatches = await tx
      .select()
      .from(eveDispatch)
      .where(
        and(
          eq(eveDispatch.conversationId, source.id),
          eq(eveDispatch.ownerId, ownerId)
        )
      );
    const receipts = await getEveMessageDisplayReceipts(
      ownerId,
      source.sessionId,
      tx
    );
    const projection = await readCompletedEveCopyTranscript(
      ownerId,
      source.sessionId,
      dispatches,
      receipts,
      target.forkMessageId ?? undefined
    );
    const heads = await tx
      .select()
      .from(eveDocumentHead)
      .where(
        and(
          eq(eveDocumentHead.conversationId, source.id),
          eq(eveDocumentHead.ownerId, ownerId)
        )
      );
    if (heads.length) {
      await tx
        .insert(eveDocumentHead)
        .values(heads.map((head) => ({ ...head, conversationId })));
    }
    const files = await tx
      .select()
      .from(eveFileReference)
      .where(
        and(
          eq(eveFileReference.conversationId, source.id),
          eq(eveFileReference.ownerId, ownerId)
        )
      );
    if (files.length) {
      await tx
        .insert(eveFileReference)
        .values(files.map((file) => ({ ...file, conversationId })))
        .onConflictDoNothing();
    }
    await tx
      .update(eveConversation)
      .set({
        initialSeed: parseEveCopySeed({
          ...projection.seed,
          attachments: "channel",
        }),
      })
      .where(eq(eveConversation.id, conversationId));
  });
};

/** Only accepted server reservations can supply trusted transcript seeds. */
export const resolveEveCurrentCopySeed = async (
  ownerId: string,
  reservationId: string
) => {
  const [row] = await db
    .select()
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.id, reservationId),
        eq(eveConversation.ownerId, ownerId)
      )
    );
  if (
    row === undefined ||
    row.initialSeed === null ||
    !["creating", "uncertain"].includes(row.state)
  ) {
    throw new Error("Copy initialization is unavailable.");
  }
  return parseEveCopySeed(row.initialSeed);
};
