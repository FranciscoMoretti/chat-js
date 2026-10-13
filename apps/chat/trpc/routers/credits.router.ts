import { getCredits } from "@/lib/db/credits";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

export const creditsRouter = createTRPCRouter({
  getAvailableCredits: protectedProcedure.query(
    async ({
      ctx,
    }: {
      readonly ctx: { readonly user: { readonly id: string } };
    }) => {
      const credits = await getCredits(ctx.user.id);
      return { credits };
    }
  ),
});
