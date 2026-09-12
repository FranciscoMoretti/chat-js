import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "./client";
import {
  assertEveCopySourceAvailable,
  EveCopySourceChanged,
  lockEveCopyOwners,
  readEveCopy,
} from "./eve-copy-journal";
import { CreationConflict } from "./eve-queries";
import {
  eveConversationCopy,
  eveConversationCopyFile,
  eveDocumentHead,
  eveDocumentRevision,
  eveFileReference,
  eveStoredFile,
} from "./schema";

/** The family lock fences writes against rejection/deletion, including an uncertain storage reply. */
export async function writeEveCopyFile(
  ownerId: string,
  conversationId: string,
  key: string,
  storage: {
    readSourceFile: (
      key: string
    ) => Promise<Pick<Blob, "type" | "arrayBuffer">>;
    writeDestinationFile: (key: string, file: Blob) => Promise<void>;
  }
) {
  const initial = await readEveCopy(db, ownerId, conversationId);
  return await db.transaction(async (tx) => {
    await lockEveCopyOwners(tx, [ownerId, initial.copy.sourceOwnerId]);
    const { copy, conversation } = await readEveCopy(
      tx,
      ownerId,
      conversationId
    );
    if (
      copy.phase === "rejected" ||
      ["deleting", "deleted"].includes(conversation.state)
    ) {
      throw new CreationConflict("Saved copy is unavailable.");
    }
    const [receipt] = await tx
      .select()
      .from(eveConversationCopyFile)
      .where(
        and(
          eq(eveConversationCopyFile.conversationId, conversationId),
          eq(eveConversationCopyFile.ownerId, ownerId),
          eq(eveConversationCopyFile.key, key)
        )
      );
    if (!receipt) {
      throw new Error("Copied file was not allocated.");
    }
    if (receipt.writtenAt) {
      return receipt;
    }
    const file = copy.plan?.files.find((candidate) => candidate.key === key);
    if (copy.phase !== "preparing" || !file) {
      throw new Error("Saved copy preparation is unavailable.");
    }
    await assertEveCopySourceAvailable(tx, copy);
    const blob =
      file.source.kind === "inline"
        ? new Blob([Buffer.from(file.source.base64, "base64")], {
            type: file.mediaType,
          })
        : await storage.readSourceFile(file.source.key);
    const bytes = Buffer.from(await blob.arrayBuffer());
    if (
      blob.type !== receipt.mediaType ||
      bytes.length !== receipt.size ||
      createHash("sha256").update(bytes).digest("hex") !== receipt.sha256
    ) {
      throw new EveCopySourceChanged(
        "Copy source file changed after preparation."
      );
    }
    await storage.writeDestinationFile(
      key,
      new Blob([bytes], { type: receipt.mediaType })
    );
    const [written] = await tx
      .update(eveConversationCopyFile)
      .set({ writtenAt: new Date() })
      .where(
        and(
          eq(eveConversationCopyFile.conversationId, conversationId),
          eq(eveConversationCopyFile.key, key)
        )
      )
      .returning();
    return written;
  });
}

/** All ancestry and heads commit together, before any copy can be accepted. */
export async function writeEveCopyDocuments(
  ownerId: string,
  conversationId: string
) {
  await db.transaction(async (tx) => {
    await lockEveCopyOwners(tx, [ownerId]);
    const { copy, conversation } = await readEveCopy(
      tx,
      ownerId,
      conversationId
    );
    if (
      copy.phase === "rejected" ||
      ["deleting", "deleted"].includes(conversation.state)
    ) {
      throw new CreationConflict("Saved copy is unavailable.");
    }
    if (copy.documentsReady) {
      return;
    }
    if (copy.phase !== "preparing" || !copy.plan) {
      throw new Error("Saved copy preparation is unavailable.");
    }
    const revisions = copy.plan.documents.flatMap((document) =>
      document.revisions.map((revision) => ({
        ...revision,
        ownerId,
        conversationId,
        documentId: document.documentId,
        operationId: `copy:${revision.id}`,
        turnIndex: null,
        createdAt: new Date(revision.createdAt),
      }))
    );
    if (revisions.length) {
      await tx.insert(eveDocumentRevision).values(revisions);
    }
    if (copy.plan.documents.length) {
      await tx.insert(eveDocumentHead).values(
        copy.plan.documents.map((document) => ({
          conversationId,
          ownerId,
          documentId: document.documentId,
          revisionId: document.headRevisionId,
        }))
      );
    }
    await tx
      .update(eveConversationCopy)
      .set({ documentsReady: true })
      .where(eq(eveConversationCopy.conversationId, conversationId));
  });
}

/** This short transaction is the publication boundary; no native or storage I/O runs inside it. */
export async function acceptEveCopy(ownerId: string, conversationId: string) {
  const initial = await readEveCopy(db, ownerId, conversationId);
  return await db.transaction(async (tx) => {
    await lockEveCopyOwners(tx, [ownerId, initial.copy.sourceOwnerId]);
    const { copy, conversation } = await readEveCopy(
      tx,
      ownerId,
      conversationId
    );
    if (
      copy.phase === "rejected" ||
      ["deleting", "deleted"].includes(conversation.state)
    ) {
      throw new CreationConflict("Saved copy is unavailable.");
    }
    if (copy.phase === "accepted" || copy.phase === "bound") {
      return copy.phase;
    }
    if (!(copy.plan && copy.documentsReady)) {
      throw new Error("Copied documents are not committed.");
    }
    await assertEveCopySourceAvailable(tx, copy);
    const heads = copy.plan.sourceHeads.length
      ? await tx
          .select({
            documentId: eveDocumentHead.documentId,
            revisionId: eveDocumentHead.revisionId,
          })
          .from(eveDocumentHead)
          .where(
            and(
              eq(eveDocumentHead.conversationId, copy.sourceConversationId),
              eq(eveDocumentHead.ownerId, copy.sourceOwnerId),
              inArray(
                eveDocumentHead.documentId,
                copy.plan.sourceHeads.map((head) => head.documentId)
              )
            )
          )
      : [];
    if (
      heads.length !== copy.plan.sourceHeads.length ||
      copy.plan.sourceHeads.some(
        (expected) =>
          !heads.some(
            (head) =>
              head.documentId === expected.documentId &&
              head.revisionId === expected.revisionId
          )
      )
    ) {
      throw new EveCopySourceChanged(
        "Published document history changed before the copy was accepted."
      );
    }
    const receipts = await tx
      .select({
        key: eveConversationCopyFile.key,
        writtenAt: eveConversationCopyFile.writtenAt,
      })
      .from(eveConversationCopyFile)
      .innerJoin(
        eveStoredFile,
        and(
          eq(eveStoredFile.key, eveConversationCopyFile.key),
          eq(eveStoredFile.ownerId, ownerId),
          eq(eveStoredFile.state, "active")
        )
      )
      .innerJoin(
        eveFileReference,
        and(
          eq(eveFileReference.key, eveConversationCopyFile.key),
          eq(eveFileReference.conversationId, conversationId),
          eq(eveFileReference.ownerId, ownerId)
        )
      )
      .where(
        and(
          eq(eveConversationCopyFile.conversationId, conversationId),
          eq(eveConversationCopyFile.ownerId, ownerId)
        )
      );
    if (
      receipts.length !== copy.plan.files.length ||
      receipts.some((receipt) => !receipt.writtenAt)
    ) {
      throw new Error("Copied file writes are not committed.");
    }
    await tx
      .update(eveConversationCopy)
      .set({
        phase: "accepted",
        seed: copy.plan.seed,
        plan: null,
        acceptedAt: new Date(),
      })
      .where(eq(eveConversationCopy.conversationId, conversationId));
    return "accepted";
  });
}
