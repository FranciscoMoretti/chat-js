import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { getChatById, getVotesByChatId, voteMessage } from "@/lib/db/queries";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

export const voteRouter = createTRPCRouter({
  getVotes: protectedProcedure
    .input(z.object({ chatId: z.string() }))
    .query(async ({ input, ctx }) => {
      const chat = await getChatById({ id: input.chatId });

      if (!chat) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Chat not found" });
      }

      if (chat.userId !== ctx.user.id) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      return await getVotesByChatId({ id: input.chatId });
    }),

  voteMessage: protectedProcedure
    .input(
      z.object({
        chatId: z.string(),
        messageId: z.string(),
        type: z.enum(["up", "down"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const chat = await getChatById({ id: input.chatId });

      if (!chat) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Chat not found" });
      }

      if (chat.userId !== ctx.user.id) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      await voteMessage({
        chatId: input.chatId,
        messageId: input.messageId,
        type: input.type,
      });

      return { success: true };
    }),
});
