import { z } from "zod";

import {
  getUserModelPreferences,
  upsertUserModelPreference,
} from "@/lib/db/queries";

import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

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
