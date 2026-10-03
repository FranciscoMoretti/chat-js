/* oxlint-disable import/no-nodejs-modules  --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { setTimeout as sleep } from "node:timers/promises";; its Node runtime boundary deliberately permits these built-ins.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
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

import { initTRPC, TRPCError } from "@trpc/server";
import { headers } from "next/headers";
import { cache } from "react";
import superjson from "superjson";
import { ZodError } from "zod";

import { auth } from "@/lib/auth";
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable import/exports-last, import/group-exports  --
 * import/exports-last (#522): createTRPCContext is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): createTRPCContext stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named createTRPCContext API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * oxc/no-async-await (#540): createTRPCContext sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): createTRPCContext handles optional session?.user without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 */
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
export const createTRPCContext = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  return {
    user: session?.user,
  };
});
/* oxlint-enable import/exports-last, import/group-exports */

/* oxlint-disable import/exports-last  --
 * import/exports-last (#522): Context is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/no-named-export (#527): Preserve the named Context API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type Context = Awaited<ReturnType<typeof createTRPCContext>>;
/* oxlint-enable import/exports-last */

/* oxlint-disable id-length, typescript/prefer-readonly-parameter-types, unicorn/no-null  --
 * id-length (#506): t uses t as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * no-ternary (#518): t derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * oxc/no-rest-spread-properties (#543): t copies or separates ...shape; ...shape.data while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/prefer-readonly-parameter-types (#565): t accepts { shape, error }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): t preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          // oxlint-disable-next-line typescript/no-deprecated -- #583: The tRPC error payload exposes flat fieldErrors; treeifyError would change the client-visible error contract.
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
  transformer: superjson,
});
/* oxlint-enable id-length, typescript/prefer-readonly-parameter-types, unicorn/no-null */

/* oxlint-disable import/exports-last, import/group-exports  --
 * import/exports-last (#522): { createCallerFactory } is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): { createCallerFactory } stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named { createCallerFactory } API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const { createCallerFactory } = t;
/* oxlint-enable import/exports-last, import/group-exports */

/* oxlint-disable import/exports-last, import/group-exports  --
 * import/exports-last (#522): createTRPCRouter is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): createTRPCRouter stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named createTRPCRouter API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
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
export const createTRPCRouter = t.router;
/* oxlint-enable import/exports-last, import/group-exports */

/* oxlint-disable no-console, no-magic-numbers, no-underscore-dangle, typescript/prefer-readonly-parameter-types  --
 * no-console (#514): timingMiddleware emits operational command/error diagnostics through console; selecting another logging transport requires a runtime-specific decision.
 * no-magic-numbers (#517): timingMiddleware uses 400, 100 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-underscore-dangle (#520): timingMiddleware accesses the established _config field convention; renaming requires changing the owning SDK or backing-field contract.
 * oxc/no-async-await (#540): timingMiddleware sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): timingMiddleware accepts { next: runNext, path }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/**
 * Middleware for timing procedure execution and adding an artificial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = t.middleware(async ({ next: runNext, path }) => {
  const start = Date.now();

  if (t._config.isDev) {
    // Add an artificial delay in development.
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await sleep(waitMs);
  }

  const result = await runNext();

  const end = Date.now();
  console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

  return result;
});
/* oxlint-enable no-console, no-magic-numbers, no-underscore-dangle, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): publicProcedure stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named publicProcedure API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure.use(timingMiddleware);
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports, no-console, typescript/prefer-readonly-parameter-types, typescript/promise-function-async  --
 * import/group-exports (#523): protectedProcedure stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named protectedProcedure API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-console (#514): protectedProcedure emits operational command/error diagnostics through console; selecting another logging transport requires a runtime-specific decision.
 * oxc/no-rest-spread-properties (#543): protectedProcedure copies or separates ...rest while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/prefer-readonly-parameter-types (#565): protectedProcedure accepts { ctx, next }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): protectedProcedure preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.user` is not null.
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const { id, ...rest } = ctx.user;
  if (!id) {
    console.error("User ID missing in session callback");
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      // This narrows `session` to a non-nullable type.
      user: { id, ...rest },
    },
  });
});
/* oxlint-enable import/group-exports, no-console, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
