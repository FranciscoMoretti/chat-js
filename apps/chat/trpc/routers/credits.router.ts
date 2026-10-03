/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { getCredits } from "@/lib/db/credits";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
/* oxlint-enable sort-imports */

/* oxlint-disable import/no-named-export, import/prefer-default-export, oxc/no-async-await, typescript/prefer-readonly-parameter-types --
 * import/no-named-export (#527): Preserve the named creditsRouter API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): creditsRouter remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * oxc/no-async-await (#540): creditsRouter sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): creditsRouter accepts { ctx }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const creditsRouter = createTRPCRouter({
  getAvailableCredits: protectedProcedure.query(async ({ ctx }) => {
    const credits = await getCredits(ctx.user.id);
    return { credits };
  }),
});
/* oxlint-enable import/no-named-export, import/prefer-default-export, oxc/no-async-await, typescript/prefer-readonly-parameter-types */
