import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  getEveConversation,
  listEveConversationBranches,
  listEveConversations,
  updateEveConversationMetadata,
} from "@/lib/db/eve-queries";
import { isEveEnabled } from "@/lib/eve/availability";
import { eveHistoryInput } from "@/lib/eve/history-input";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

const eveProcedure = protectedProcedure.use(({ next }) => {
  if (!isEveEnabled()) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }
  return next();
});

export const eveRouter = createTRPCRouter({
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
