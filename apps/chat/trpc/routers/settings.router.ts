import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  getUserModelPreferences,
  upsertUserModelPreference,
} from "@/lib/db/queries";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (settingsRouter); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve settingsRouter's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable sort-imports */

/* oxlint-disable unicorn/max-nested-calls -- * unicorn/max-nested-calls (#568): settingsRouter keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold. */
export const settingsRouter = createTRPCRouter({
  getModelPreferences: protectedProcedure.query(
    async ({
      ctx,
    }: {
      readonly ctx: { readonly user: { readonly id: string } };
    }) => await getUserModelPreferences({ userId: ctx.user.id })
  ),

  setModelEnabled: protectedProcedure
    .input(
      z.object({
        enabled: z.boolean(),
        modelId: z.string(),
      })
    )
    .mutation(
      async ({
        ctx,
        input,
      }: {
        readonly ctx: { readonly user: { readonly id: string } };
        readonly input: ReadonlyNativeSurface<{
          enabled: boolean;
          modelId: string;
        }>;
      }) => {
        await upsertUserModelPreference({
          enabled: input.enabled,
          modelId: input.modelId,
          userId: ctx.user.id,
        });
        return { success: true };
      }
    ),
});
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable unicorn/max-nested-calls */
