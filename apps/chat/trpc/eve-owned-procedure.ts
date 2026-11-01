import { TRPCError } from "@trpc/server";
import { headers } from "next/headers";
import { resolveEvePrincipal } from "@/lib/eve/principal";
import { publicProcedure } from "./init";

export const eveOwnedProcedure = publicProcedure.use(
  async ({
    ctx,
    next,
  }: Readonly<
    Pick<
      Parameters<(typeof publicProcedure)["_def"]["middlewares"][0]>[0],
      "next"
    >
  > & { readonly ctx: { readonly user?: { readonly id: string } | null } }) => {
    let ownerId = ctx.user?.id;
    if (typeof ownerId !== "string" || ownerId === "") {
      const principal = await resolveEvePrincipal(await headers());
      ownerId = principal?.ownerId;
    }
    if (typeof ownerId !== "string" || ownerId === "") {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return await next({ ctx: { eveOwnerId: ownerId } });
  }
);
