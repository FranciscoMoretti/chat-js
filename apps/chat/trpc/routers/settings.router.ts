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
