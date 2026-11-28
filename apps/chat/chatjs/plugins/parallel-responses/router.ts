import { TRPCError } from "@trpc/server";
import { after } from "next/server";
import { createTRPCRouter } from "@/trpc/init";
import { eveOwnedProcedure } from "@/trpc/eve-owned-procedure";
import { env } from "@/lib/env";
import { runChatAfterCreate } from "@/lib/chat-after-create";
import { sameOrigin } from "@/lib/eve/request-policy";
import { createEveResponseGroup } from "./response-group";
import { eveResponseGroupInput } from "./response-group-input";
import { eveResponseGroupResult } from "./response-group-contracts";

const submit = eveOwnedProcedure
  .use(async ({ ctx, next }) => {
    const { request } = ctx;
    if (
      !request ||
      !sameOrigin(request, new URL(env.APP_URL ?? request.url).origin)
    ) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return await next();
  })
  .input(eveResponseGroupInput)
  .mutation(async ({ ctx, input }) => {
    try {
      const result = eveResponseGroupResult.parse(
        await createEveResponseGroup(ctx.eveOwnerId, input)
      );
      const bound = result.candidates.find(
        (candidate) => candidate.state === "bound"
      );
      if (!input.fork && bound) {
        after(async () => {
          await runChatAfterCreate({
            branchId: bound.branchId,
            message: input.message,
            ownerId: ctx.eveOwnerId,
          });
        });
      }
      return result;
    } catch {
      throw new TRPCError({
        code: "CONFLICT",
        message:
          "Response group is unavailable or unresolved. Retain the original request before retrying.",
      });
    }
  });

export const router = createTRPCRouter({ parallelResponses: { submit } });
