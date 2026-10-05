import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  getUserModelPreferences,
  upsertUserModelPreference,
} from "@/lib/db/queries";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve settingsRouter's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable sort-imports */

/* oxlint-disable typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls --
 * typescript/prefer-readonly-parameter-types (#565): settingsRouter accepts { ctx }; { ctx, input }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * unicorn/max-nested-calls (#568): settingsRouter keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
export const settingsRouter = createTRPCRouter({
  getModelPreferences: protectedProcedure.query(
    async ({ ctx }) => await getUserModelPreferences({ userId: ctx.user.id })
  ),

  setModelEnabled: protectedProcedure
    .input(
      z.object({
        enabled: z.boolean(),
        modelId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await upsertUserModelPreference({
        enabled: input.enabled,
        modelId: input.modelId,
        userId: ctx.user.id,
      });
      return { success: true };
    }),
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls */
