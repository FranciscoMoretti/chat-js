import { z } from "zod";
import { createTRPCRouter } from "@/trpc/init";
import { eveOwnedProcedure } from "@/trpc/eve-owned-procedure";
import { getEveFollowup } from "./followup-queries";

export const followupSuggestionsRouter = createTRPCRouter({
  get: eveOwnedProcedure
    .input(
      z.object({
        conversationId: z.uuid(),
        eventId: z.string().min(1).max(512),
      })
    )
    .query(
      async ({
        ctx,
        input,
      }: {
        readonly ctx: { readonly eveOwnerId: string };
        readonly input: {
          readonly conversationId: string;
          readonly eventId: string;
        };
      }) =>
        await getEveFollowup(
          ctx.eveOwnerId,
          input.conversationId,
          input.eventId
        )
    ),
});
