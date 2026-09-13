import { z } from "zod";

import {
  getUserModelPreferences,
  upsertUserModelPreference,
} from "@/lib/db/queries";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

export const settingsRouter = createTRPCRouter({
  getModelPreferences: protectedProcedure.query(
    async ({ ctx }) => await getUserModelPreferences({ userId: ctx.user.id })
  ),

  setModelEnabled: protectedProcedure
    .input(
      z.object({
        modelId: z.string(),
        enabled: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await upsertUserModelPreference({
        userId: ctx.user.id,
        modelId: input.modelId,
        enabled: input.enabled,
      });
      return { success: true };
    }),
});
