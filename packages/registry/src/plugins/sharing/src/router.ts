import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { getSharing, setSharing } from "./queries";

export const sharingRouter = createTRPCRouter({
  get: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const row = await getSharing(ctx.user.id, input.id);
      if (row === undefined) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return row;
    }),
  setVisibility: protectedProcedure
    .input(
      z.object({ id: z.uuid(), visibility: z.enum(["private", "public"]) })
    )
    .mutation(async ({ ctx, input }) => {
      const row = await setSharing(ctx.user.id, input.id, input.visibility);
      if (row === undefined) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return row;
    }),
});
