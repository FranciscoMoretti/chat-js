import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  getEveConversation,
  listEveConversations,
  updateEveConversationMetadata,
} from "@/lib/db/eve-queries";
import { isEveEnabled } from "@/lib/eve/availability";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

const eveProcedure = protectedProcedure.use(({ next }) => {
  if (!isEveEnabled()) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }
  return next();
});

export const eveRouter = createTRPCRouter({
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
  list: eveProcedure.query(async ({ ctx }) => {
    const rows = await listEveConversations(ctx.user.id);
    return rows.map((row) => ({
      id: row.id,
      title: row.title ?? row.firstMessage.slice(0, 100),
      isPinned: row.isPinned,
      projectId: null,
    }));
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
