import { z } from "zod";
import { createTRPCRouter } from "@/trpc/init";
import { eveOwnedProcedure } from "@/trpc/eve-owned-procedure";
import { getEveFollowup } from "./followup-queries";

const followupSuggestionsProcedures = {
  get: eveOwnedProcedure
    .input(
      z.object({
        branchId: z.uuid(),
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
          readonly branchId: string;
          readonly eventId: string;
        };
      }) => await getEveFollowup(ctx.eveOwnerId, input.branchId, input.eventId)
    ),
};

export const router = createTRPCRouter({
  followupSuggestions: followupSuggestionsProcedures,
});
