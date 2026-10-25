import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter } from "@/trpc/init";
import { eveOwnedProcedure } from "@/trpc/eve-owned-procedure";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { getEveMessageVotes } from "./feedback-queries";
import { voteEveMessage } from "./vote-message";

const MAX_MESSAGE_ID_LENGTH = 512;
export const feedbackRouter = createTRPCRouter({
  vote: eveOwnedProcedure
    .input(
      z.object({
        conversationId: z.uuid(),
        messageId: z.string().nonempty().max(MAX_MESSAGE_ID_LENGTH),
        type: z.enum(["up", "down"]),
      })
    )
    .mutation(
      async ({
        ctx,
        input,
      }: {
        readonly ctx: { readonly eveOwnerId: string };
        readonly input: ReadonlyNativeSurface<{
          conversationId: string;
          messageId: string;
          type: "up" | "down";
        }>;
      }) => {
        const saved = await voteEveMessage(ctx.eveOwnerId, input);
        if (!saved) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Assistant message not found.",
          });
        }
        return saved;
      }
    ),
  votes: eveOwnedProcedure
    .input(z.object({ conversationId: z.uuid() }))
    .query(
      async ({
        ctx,
        input,
      }: {
        readonly ctx: { readonly eveOwnerId: string };
        readonly input: { readonly conversationId: string };
      }) => await getEveMessageVotes(ctx.eveOwnerId, input.conversationId)
    ),
});
