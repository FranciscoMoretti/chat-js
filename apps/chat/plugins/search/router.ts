import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eveOwnedProcedure } from "@/trpc/eve-owned-procedure";
import { createTRPCRouter } from "@/trpc/init";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { MAX_SEARCH_QUERY_LENGTH } from "./search-text";
import { searchEveConversations } from "./search-queries";

const MAX_OWNER_SCOPE_LENGTH = 128;
export const searchRouter = createTRPCRouter({
  query: eveOwnedProcedure
    .input(
      z.object({
        cursor: z
          .object({
            id: z.uuid(),
            rank: z.number().nonnegative(),
            updatedAt: z.iso.datetime(),
          })
          .nullish(),
        ownerScope: z.string().nonempty().max(MAX_OWNER_SCOPE_LENGTH),
        search: z.string().trim().nonempty().max(MAX_SEARCH_QUERY_LENGTH),
      })
    )
    .query(
      async ({
        ctx,
        input,
      }: {
        readonly ctx: { readonly eveOwnerId: string };
        readonly input: ReadonlyNativeSurface<{
          ownerScope: string;
          search: string;
          cursor?:
            | { id: string; rank: number; updatedAt: string }
            | null
            | undefined;
        }>;
      }) => {
        if (input.ownerScope !== ctx.eveOwnerId) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return await searchEveConversations(ctx.eveOwnerId, input);
      }
    ),
});
