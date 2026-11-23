import { getBalanceCents } from "./credits-queries";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

const creditsProcedures = {
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
};

export const router = createTRPCRouter({ credits: creditsProcedures });
