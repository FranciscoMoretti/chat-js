import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { ArtifactKind } from "@/lib/artifacts/artifact-kind";
import {
  getDocumentById,
  getDocumentsById,
  getPublicDocumentsById,
  saveDocument,
} from "@/lib/db/queries";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/trpc/init";

export const documentRouter = createTRPCRouter({
  getDocuments: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const documents = await getDocumentsById({
        id: input.id,
        userId: ctx.user.id,
      });

      if (documents.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      return documents;
    }),

  getPublicDocuments: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const documents = await getPublicDocumentsById({ id: input.id });

      if (documents.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Public document not found",
        });
      }

      return documents;
    }),

  saveDocument: protectedProcedure
    .input(
      z.object({
        content: z.string(),
        id: z.string(),
        kind: z.custom<ArtifactKind>(),
        title: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const lastDocument = await getDocumentById({ id: input.id });

      if (!lastDocument) {
        throw new Error("Document not found");
      }

      const _document = await saveDocument({
        content: input.content,
        id: input.id,
        kind: input.kind,
        messageId: lastDocument.messageId,
        title: input.title,
        userId: ctx.user.id,
      });

      return { success: true };
    }),
});
