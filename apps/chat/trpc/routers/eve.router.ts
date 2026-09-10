import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getAccessibleEveDocument } from "@/lib/db/eve-documents";
import {
  getEveConversation,
  listEveConversationBranches,
  listEveConversations,
  updateEveConversationMetadata,
} from "@/lib/db/eve-queries";
import { isEveEnabled } from "@/lib/eve/availability";
import { eveManualDocumentInput } from "@/lib/eve/document-contracts";
import { eveHistoryInput } from "@/lib/eve/history-input";
import { saveManualEveDocument } from "@/lib/eve/save-document";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/trpc/init";

const eveProcedure = protectedProcedure.use(({ next }) => {
  if (!isEveEnabled()) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }
  return next();
});

export const eveRouter = createTRPCRouter({
  saveDocument: eveProcedure
    .input(eveManualDocumentInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await saveManualEveDocument(ctx.user.id, input);
      } catch (cause) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            cause instanceof Error
              ? cause.message
              : "Document could not be saved.",
          cause,
        });
      }
    }),
  document: publicProcedure
    .input(
      z.object({
        conversationId: z.uuid(),
        documentId: z.uuid(),
        revisionId: z.uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!isEveEnabled()) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const document = await getAccessibleEveDocument(
        ctx.user?.id,
        input.conversationId,
        input.documentId,
        input.revisionId
      );
      if (!document) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return document;
    }),
  branches: eveProcedure
    .input(z.object({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const family = await listEveConversationBranches(ctx.user.id, input.id);
      if (!family) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return family;
    }),
  get: eveProcedure
    .input(z.object({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const row = await getEveConversation(ctx.user.id, input.id);
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return { id: row.id, visibility: row.visibility };
    }),
  setVisibility: eveProcedure
    .input(
      z.object({ id: z.uuid(), visibility: z.enum(["private", "public"]) })
    )
    .mutation(async ({ ctx, input }) => {
      const row = await updateEveConversationMetadata(ctx.user.id, input.id, {
        visibility: input.visibility,
      });
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return row;
    }),
  list: eveProcedure.input(eveHistoryInput).query(async ({ ctx, input }) => {
    return await listEveConversations(ctx.user.id, input);
  }),
  rename: eveProcedure
    .input(z.object({ id: z.uuid(), title: z.string().trim().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      const updated = await updateEveConversationMetadata(
        ctx.user.id,
        input.id,
        { title: input.title }
      );
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return updated;
    }),
  pin: eveProcedure
    .input(z.object({ id: z.uuid(), isPinned: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await updateEveConversationMetadata(
        ctx.user.id,
        input.id,
        { isPinned: input.isPinned }
      );
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return updated;
    }),
});
