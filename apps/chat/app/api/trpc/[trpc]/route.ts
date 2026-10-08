import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

// oxlint-disable-next-line sort-imports -- This readonly view preserves the native request/session members and follows the existing runtime import group.
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { createTRPCContext } from "@/trpc/init";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { appRouter } from "@/trpc/routers/_app";

/* oxlint-enable sort-imports */

/* oxlint-disable typescript/promise-function-async -- deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/promise-function-async (#606): handler preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections. */

const handler = (req: ReadonlyNativeSurface<Request>): Promise<Response> =>
  fetchRequestHandler({
    createContext: createTRPCContext,
    endpoint: "/api/trpc",
    req,
    router: appRouter,
  });
/* oxlint-disable import/no-named-export -- Framework discovery uses these named bindings (GET, POST); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable typescript/promise-function-async */

export { handler as GET, handler as POST };
/* oxlint-enable import/no-named-export */
