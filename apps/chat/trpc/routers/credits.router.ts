import { getCredits } from "@/lib/db/credits";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (creditsRouter); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve creditsRouter's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable sort-imports */

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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
