/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */
import { TRPCError, initTRPC } from "@trpc/server";
import type { TRPCDefaultErrorShape } from "@trpc/server";
import { headers } from "next/headers";
import { cache } from "react";
import { setTimeout as sleep } from "node:timers/promises";
import superjson from "superjson";
import { ZodError, flattenError } from "zod";

import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { auth } from "@/lib/auth";

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
const createTRPCContext = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  return {
    user: session?.user,
  };
});
type Context = Awaited<ReturnType<typeof createTRPCContext>>;

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const trpc = initTRPC.context<typeof createTRPCContext>().create({
  errorFormatter({
    shape,
    error,
  }: {
    readonly shape: ReadonlyNativeSurface<TRPCDefaultErrorShape>;
    readonly error: { readonly cause?: unknown };
  }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? flattenError(error.cause) : null,
      },
    };
  },
  transformer: superjson,
});

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
const { createCallerFactory } = trpc;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
const createTRPCRouter = trpc.router;

const MIN_DEVELOPMENT_DELAY_MS = 100;
const DEVELOPMENT_DELAY_RANGE_MS = 400;

/**
 * Middleware for timing procedure execution and adding an artificial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = trpc.middleware(
  async ({
    next: runNext,
    path,
  }: ReadonlyNativeSurface<
    Pick<
      Parameters<ReturnType<typeof trpc.middleware>["_middlewares"][0]>[0],
      "next" | "path"
    >
  >) => {
    const start = Date.now();

    if (trpc._config.isDev) {
      // Add an artificial delay in development.
      const waitMs =
        Math.floor(Math.random() * DEVELOPMENT_DELAY_RANGE_MS) +
        MIN_DEVELOPMENT_DELAY_MS;
      await sleep(waitMs);
    }

    const result = await runNext();

    const end = Date.now();
    console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

    return result;
  }
);

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
const publicProcedure = trpc.procedure.use(timingMiddleware);

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.user` is not null.
 *
 * @see https://trpc.io/docs/procedures
 */
const protectedProcedure = trpc.procedure.use(
  async ({
    ctx,
    next,
  }: ReadonlyNativeSurface<
    Parameters<ReturnType<typeof trpc.middleware>["_middlewares"][0]>[0]
  >) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    const { id, ...rest } = ctx.user;
    if (!id) {
      console.error("User ID missing in session callback");
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return await next({
      ctx: {
        // This narrows `session` to a non-nullable type.
        user: { id, ...rest },
      },
    });
  }
);
export {
  createCallerFactory,
  createTRPCContext,
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
};
export type { Context };
