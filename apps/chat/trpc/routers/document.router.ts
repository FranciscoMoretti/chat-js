import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { artifactKinds } from "@/lib/artifacts/artifact-kind";
import {
  getDocumentsById,
  getPublicDocumentsById,
  updateDocument,
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
        id: z.string(),
        content: z.string(),
        title: z.string(),
        kind: z.enum(artifactKinds),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const saved = await updateDocument({
        id: input.id,
        content: input.content,
        title: input.title,
        kind: input.kind,
        userId: ctx.user.id,
      });
      if (!saved) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      return { success: true };
    }),
});
