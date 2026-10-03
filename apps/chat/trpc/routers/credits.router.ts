import { getCredits } from "@/lib/db/credits";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

/* oxlint-disable typescript/prefer-readonly-parameter-types --
 * typescript/prefer-readonly-parameter-types (#565): creditsRouter accepts { ctx }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const creditsRouter = createTRPCRouter({
  getAvailableCredits: protectedProcedure.query(async ({ ctx }) => {
    const credits = await getCredits(ctx.user.id);
    return { credits };
  }),
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
