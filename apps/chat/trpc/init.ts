/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { setTimeout as sleep } from "node:timers/promises";; its Node runtime boundary deliberately permits these built-ins.
 */
/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */

import { setTimeout as sleep } from "node:timers/promises";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { TRPCError, initTRPC } from "@trpc/server";
/* oxlint-enable sort-imports */
import { headers } from "next/headers";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { cache } from "react";
/* oxlint-enable sort-imports */
import superjson from "superjson";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { ZodError } from "zod";
/* oxlint-enable sort-imports */

import { auth } from "@/lib/auth";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve createTRPCContext's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable import/no-nodejs-modules */

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
/* oxlint-enable oxc/no-async-await */
type Context = Awaited<ReturnType<typeof createTRPCContext>>;

/* oxlint-disable typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * typescript/prefer-readonly-parameter-types (#565): trpc accepts { shape, error }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): trpc preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const trpc = initTRPC.context<typeof createTRPCContext>().create({
  errorFormatter({ shape, error }) {
    return {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing shape own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...shape,
      data: {
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing shape.data own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...shape.data,
        zodError:
          // oxlint-disable-next-line typescript/no-deprecated -- #583: The tRPC error payload exposes flat fieldErrors; treeifyError would change the client-visible error contract.
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
  transformer: superjson,
});
/* oxlint-enable typescript/prefer-readonly-parameter-types, unicorn/no-null */

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

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve timingMiddleware's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-console, no-magic-numbers, no-underscore-dangle, typescript/prefer-readonly-parameter-types --
 * no-console (#514): timingMiddleware emits operational command/error diagnostics through console; selecting another logging transport requires a runtime-specific decision.
 * no-magic-numbers (#517): timingMiddleware uses 400, 100 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-underscore-dangle (#520): timingMiddleware accesses the established _config field convention; renaming requires changing the owning SDK or backing-field contract.
 * typescript/prefer-readonly-parameter-types (#565): timingMiddleware accepts { next: runNext, path }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/**
 * Middleware for timing procedure execution and adding an artificial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = trpc.middleware(async ({ next: runNext, path }) => {
  const start = Date.now();

  if (trpc._config.isDev) {
    // Add an artificial delay in development.
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await sleep(waitMs);
  }

  const result = await runNext();

  const end = Date.now();
  console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

  return result;
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-console, no-magic-numbers, no-underscore-dangle, typescript/prefer-readonly-parameter-types */

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
const publicProcedure = trpc.procedure.use(timingMiddleware);

/* oxlint-disable no-console, typescript/prefer-readonly-parameter-types, typescript/promise-function-async -- no-console (#514): protectedProcedure emits operational command/error diagnostics through console; selecting another logging transport requires a runtime-specific decision.
typescript/prefer-readonly-parameter-types (#565): protectedProcedure accepts { ctx, next }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/promise-function-async (#606): protectedProcedure preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections. */
/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.user` is not null.
 *
 * @see https://trpc.io/docs/procedures
 */
const protectedProcedure = trpc.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding rest excludes id from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  const { id, ...rest } = ctx.user;
  if (!id) {
    console.error("User ID missing in session callback");
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      // This narrows `session` to a non-nullable type.
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing rest own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      user: { id, ...rest },
    },
  });
});
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (createCallerFactory, createTRPCContext, createTRPCRouter, protectedProcedure, publicProcedure); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable no-console, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
export {
  createCallerFactory,
  createTRPCContext,
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
};
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (Context); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { Context };
/* oxlint-enable import/no-named-export */
