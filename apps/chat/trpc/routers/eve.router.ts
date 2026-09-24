import { TRPCError } from "@trpc/server";
import { headers } from "next/headers";
import { z } from "zod";

import { getAccessibleEveDocument } from "@/lib/db/eve-documents";
import {
  getEveChatIdentity,
  listEveConversationBranches,
  listEveConversations,
  updateEveConversationMetadata,
} from "@/lib/db/eve-queries";
import {
  assignEveConversationProject,
  getEveMessageVotes,
} from "@/lib/db/queries";
import { eveManualDocumentInput } from "@/lib/eve/document-contracts";
import { eveHistoryInput } from "@/lib/eve/history-input";
import { resolveEvePrincipal } from "@/lib/eve/principal";
import { saveManualEveDocument } from "@/lib/eve/save-document";
import { voteEveMessage } from "@/lib/eve/vote-message";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/trpc/init";

const eveProcedure = protectedProcedure;

const eveOwnedProcedure = publicProcedure.use(async ({ ctx, next }) => {
  let ownerId = ctx.user?.id;
  if (!ownerId) {
    const principal = await resolveEvePrincipal(await headers());
    ownerId = principal?.ownerId;
  }
  if (!ownerId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { eveOwnerId: ownerId } });
});

export const eveRouter = createTRPCRouter({
  assignProject: eveProcedure
    .input(
      z.object({ conversationId: z.uuid(), projectId: z.uuid().nullable() })
    )
    .mutation(async ({ ctx, input }) => {
      const assigned = await assignEveConversationProject(
        ctx.user.id,
        input.conversationId,
        input.projectId
      );
      if (!assigned) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation or project not found.",
        });
      }
      return assigned;
    }),
  branches: eveOwnedProcedure
    .input(z.object({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const family = await listEveConversationBranches(
        ctx.eveOwnerId,
        input.id
      );
      if (!family) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return family;
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
      let ownerId = ctx.user?.id;
      if (!ownerId) {
        const principal = await resolveEvePrincipal(await headers());
        ownerId = principal?.ownerId;
      }
      const document = await getAccessibleEveDocument(
        ownerId,
        input.conversationId,
        input.documentId,
        input.revisionId
      );
      if (!document) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return document;
    }),
  get: eveOwnedProcedure
    .input(z.object({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const row = await getEveChatIdentity(ctx.eveOwnerId, input.id);
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return row;
    }),
  list: eveOwnedProcedure
    .input(eveHistoryInput)
    .query(async ({ ctx, input }) => {
      if (input.ownerScope && input.ownerScope !== ctx.eveOwnerId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return await listEveConversations(ctx.eveOwnerId, input);
    }),
  pin: eveOwnedProcedure
    .input(z.object({ id: z.uuid(), isPinned: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await updateEveConversationMetadata(
        ctx.eveOwnerId,
        input.id,
        { isPinned: input.isPinned }
      );
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return updated;
    }),
  rename: eveOwnedProcedure
    .input(z.object({ id: z.uuid(), title: z.string().trim().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      const updated = await updateEveConversationMetadata(
        ctx.eveOwnerId,
        input.id,
        { title: input.title }
      );
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return updated;
    }),
  saveDocument: eveOwnedProcedure
    .input(eveManualDocumentInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await saveManualEveDocument(ctx.eveOwnerId, input);
      } catch (error) {
        throw new TRPCError({
          cause: error,
          code: "CONFLICT",
          message:
            error instanceof Error
              ? error.message
              : "Document could not be saved.",
        });
      }
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
  vote: eveOwnedProcedure
    .input(
      z.object({
        conversationId: z.uuid(),
        messageId: z.string().min(1).max(512),
        type: z.enum(["up", "down"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const saved = await voteEveMessage(ctx.eveOwnerId, input);
      if (!saved) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assistant message not found.",
        });
      }
      return saved;
    }),
  votes: eveOwnedProcedure
    .input(z.object({ conversationId: z.uuid() }))
    .query(
      async ({ ctx, input }) =>
        await getEveMessageVotes(ctx.eveOwnerId, input.conversationId)
    ),
});
