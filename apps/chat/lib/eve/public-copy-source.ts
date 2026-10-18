import { getEveMessageDisplayReceipts } from "@/lib/db/eve-dispatch";
import { assertEveConfigured } from "./server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { eveConversation, eveDispatch } from "@/lib/db/schema";
import { snapshotPublicEveCopyDocuments } from "@/lib/db/eve-copy-documents";
import { readCompletedEveCopyTranscript } from "./completed-copy-source";
import { getPublicEveConversation } from "@/lib/db/eve-queries";
import type { prepareEveCopyTranscript } from "./copy-transcript";

const PUBLIC_COPY_TITLE_PREVIEW_MAX_LENGTH = 100;
const TITLE_PREVIEW_START = 0;

export const readPublicEveCopySource = async (
  id: string
): Promise<{
  documents: Awaited<ReturnType<typeof snapshotPublicEveCopyDocuments>>;
  id: string;
  ownerId: string;
  projection: ReturnType<typeof prepareEveCopyTranscript>;
  sessionId: string;
  title: string;
}> => {
  const row = await getPublicEveConversation(id);
  if (!row || typeof row.sessionId !== "string" || row.sessionId === "") {
    throw new Error("Shared conversation is unavailable.");
  }
  const { sessionId } = row;
  assertEveConfigured();
  return await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-family:${row.ownerId}`}, 0))`
    );
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`eve-document:${id}`}, 0))`
    );
    const [current] = await tx
      .select()
      .from(eveConversation)
      .where(
        and(
          eq(eveConversation.id, id),
          eq(eveConversation.ownerId, row.ownerId),
          eq(eveConversation.sessionId, sessionId),
          eq(eveConversation.state, "bound"),
          eq(eveConversation.visibility, "public")
        )
      )
      .for("share");
    if (current === undefined) {
      throw new Error("Shared conversation is unavailable.");
    }
    const dispatches = await tx
      .select()
      .from(eveDispatch)
      .where(
        and(
          eq(eveDispatch.ownerId, row.ownerId),
          eq(eveDispatch.conversationId, id)
        )
      );
    const receipts = await getEveMessageDisplayReceipts(
      row.ownerId,
      sessionId,
      tx
    );
    const projection = await readCompletedEveCopyTranscript(
      row.ownerId,
      sessionId,
      dispatches,
      receipts
    );
    const documents = await snapshotPublicEveCopyDocuments(
      id,
      sessionId,
      projection.resources,
      tx
    );
    return {
      documents,
      id: row.id,
      ownerId: row.ownerId,
      projection,
      sessionId,
      title:
        row.title ??
        row.firstMessage.slice(
          TITLE_PREVIEW_START,
          PUBLIC_COPY_TITLE_PREVIEW_MAX_LENGTH
        ),
    };
  });
};
