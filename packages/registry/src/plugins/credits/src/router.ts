import { getBalanceCents } from "./credits-queries";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

export const creditsRouter = createTRPCRouter({
  getAvailableCredits: protectedProcedure.query(
    async ({
      ctx,
    }: {
      readonly ctx: { readonly user: { readonly id: string } };
    }) => {
      const balanceCents = await getBalanceCents(ctx.user.id);
      return { balanceCents };
    }
  ),
});
