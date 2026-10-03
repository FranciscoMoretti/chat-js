import { z } from "zod";

import {
  getUserModelPreferences,
  upsertUserModelPreference,
} from "@/lib/db/queries";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

/* oxlint-disable typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls  --
 * import/no-named-export (#527): Preserve the named settingsRouter API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): settingsRouter remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * oxc/no-async-await (#540): settingsRouter sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
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
/* oxlint-enable typescript/prefer-readonly-parameter-types, unicorn/max-nested-calls */
