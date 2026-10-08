import { getCredits } from "@/lib/db/credits";
// oxlint-disable-next-line sort-imports -- Import-order migration debt: the native permutation between @/lib/db/credits and @/trpc/init still needs a supported server equivalence check; preserve the existing order meanwhile.
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (creditsRouter); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve creditsRouter's awaited sequencing and rejected-Promise behavior. */

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
