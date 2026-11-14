import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { artifactKind } from "@/lib/artifacts/artifact-kind";
import type {
  DocumentRepository,
  DocumentRevision,
  DocumentToolContext,
} from "@/lib/eve/document-repository";
import { bindSlackSession, lockSlackWorkspace } from "./slack-store";
import { slackDocument, slackDocumentRevision } from "./slack-schema";

const revisionResult = (
  row: typeof slackDocumentRevision.$inferSelect
): DocumentRevision => ({
  id: row.id,
  documentId: row.documentId,
  createdAt: row.createdAt,
  title: row.title,
  kind: artifactKind.parse(row.kind),
  content: row.content,
  fileIds: row.fileIds,
});

export const slackDocuments = async (
  context: DocumentToolContext
): Promise<DocumentRepository> => {
  if (context.session.parent !== undefined) {
    throw new Error(
      "Slack documents require the conversation's current caller."
    );
  }
  const scope = await bindSlackSession(context.session);
  return {
    read: async (documentId) => {
      await bindSlackSession(context.session);
      const rows = await db
        .select({ revision: slackDocumentRevision })
        .from(slackDocument)
        .innerJoin(
          slackDocumentRevision,
          eq(slackDocument.headRevisionId, slackDocumentRevision.id)
        )
        .where(
          and(
            eq(slackDocument.id, documentId),
            eq(slackDocument.teamId, scope.teamId),
            eq(slackDocument.conversationId, scope.conversationId)
          )
        );
      const row = rows.at(0);
      return row === undefined ? undefined : revisionResult(row.revision);
    },
    save: async (input) => {
      await bindSlackSession(context.session);
      context.abortSignal.throwIfAborted();
      if (input.fileIds.length !== 0) {
        throw new Error(
          "Slack documents cannot reference private web files. Save text content without file IDs."
        );
      }
      const operationId = `${context.session.id}:${input.operationId}`;
      const requestHash = createHash("sha256")
        .update(
          JSON.stringify([
            input.documentId,
            input.expectedRevisionId,
            input.kind,
            input.title,
            input.content,
            input.fileIds,
          ])
        )
        .digest("hex");
      return await db.transaction(async (tx) => {
        await lockSlackWorkspace(tx, scope.teamId);
        const prior = await tx
          .select()
          .from(slackDocumentRevision)
          .where(
            and(
              eq(slackDocumentRevision.conversationId, scope.conversationId),
              eq(slackDocumentRevision.teamId, scope.teamId),
              eq(slackDocumentRevision.operationId, operationId)
            )
          );
        const receipt = prior.at(0);
        if (receipt !== undefined) {
          if (
            receipt.requestHash !== requestHash ||
            receipt.actorId !== scope.actorId
          ) {
            throw new Error("Slack document operation identity conflict.");
          }
          return revisionResult(receipt);
        }
        if (input.expectedRevisionId === null) {
          await tx
            .insert(slackDocument)
            .values({
              id: input.documentId,
              teamId: scope.teamId,
              conversationId: scope.conversationId,
              creatorId: scope.actorId,
            })
            .onConflictDoNothing();
        }
        const heads = await tx
          .select()
          .from(slackDocument)
          .where(
            and(
              eq(slackDocument.id, input.documentId),
              eq(slackDocument.teamId, scope.teamId),
              eq(slackDocument.conversationId, scope.conversationId)
            )
          );
        const head = heads.at(0);
        if (
          head === undefined ||
          head.headRevisionId !== input.expectedRevisionId
        ) {
          throw new Error(
            "Document not found or changed. Read it again before editing."
          );
        }
        const rows = await tx
          .insert(slackDocumentRevision)
          .values({
            documentId: input.documentId,
            conversationId: scope.conversationId,
            teamId: scope.teamId,
            actorId: scope.actorId,
            operationId,
            requestHash,
            kind: input.kind,
            title: input.title,
            content: input.content,
            fileIds: [],
          })
          .returning();
        const revision = rows.at(0);
        if (revision === undefined) {
          throw new Error("Slack document could not be saved.");
        }
        await tx
          .update(slackDocument)
          .set({ headRevisionId: revision.id })
          .where(eq(slackDocument.id, head.id));
        return revisionResult(revision);
      });
    },
  };
};
