"use client";

/* oxlint-disable import/max-dependencies --
 * import/max-dependencies (#524): import from "@tanstack/react-query" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 */
import { QueryClientProvider, isServer } from "@tanstack/react-query";
import React, { useState } from "react";
import type { AppRouter } from "@/trpc/routers/_app";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
// oxlint-disable-next-line sort-imports -- Import-order migration debt: the native permutation between @tanstack/react-query-devtools and @trpc/client still needs a supported client equivalence check; preserve the existing order meanwhile.
import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
import { createTRPCContext } from "@trpc/tanstack-react-query";

import superjson from "superjson";

// oxlint-disable-next-line sort-imports -- Import-order migration debt: the native permutation between superjson and @/lib/env still needs a supported client equivalence check; preserve the existing order meanwhile.
import { env } from "@/lib/env";

import { getBaseUrl } from "@/lib/url";

import { isAbortedRequest } from "./is-aborted-request";
/* oxlint-enable import/max-dependencies */
import { makeQueryClient } from "./query-client";

const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>();

/* oxlint-disable init-declarations --
 * init-declarations (#507): browserQueryClient assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 */
let browserQueryClient: QueryClient | undefined;
/* oxlint-enable init-declarations */

const getQueryClient = (): QueryClient => {
  // oxlint-disable-next-line typescript/no-deprecated -- #583: Preserve TanStack Query server detection until its SSR and hydration boundary is migrated together.
  if (isServer) {
    // Server: always make a new query client
    return makeQueryClient();
  }
  // Browser: make a new query client if we don't already have one
  // This is very important, so we don't re-make a new client if React
  // suspends during the initial render. This may not be needed if we
  // have a suspense boundary BELOW the creation of the query client
  // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: Preserve the existing lazy initialization or absent-value guard; replacing it with coalescing changes the control-flow form.
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
};

const getUrl = (): string => {
  const base = ((): string => {
    // oxlint-disable-next-line unicorn/prefer-global-this -- #572: This tests for a browser window; globalThis also exists during server rendering.
    if (typeof window !== "undefined") {
      return "";
    }
    return getBaseUrl();
  })();
  return `${base}/api/trpc`;
};
/* oxlint-disable node/no-process-env, unicorn/no-null -- node/no-process-env (#537): TRPCReactProvider reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
unicorn/no-null (#570): TRPCReactProvider preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
const TRPCReactProvider = (props: {
  readonly children: ReadonlyReactNode;
}): React.JSX.Element => {
  const queryClient = getQueryClient();

  // A state initializer creates the client lazily and preserves identity for this provider mount.
  // A ref initializer requires render-time `.current` access under the effective react/refs rule; useMemo does not guarantee resource identity.
  // oxlint-disable-next-line react/hook-use-state -- Keep this mounted TRPC client stable under the active render-time ref restriction.
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        loggerLink({
          enabled: (op: {
            readonly direction: string;
            readonly result?: unknown;
          }): boolean => {
            if (op.direction === "down" && isAbortedRequest(op.result)) {
              return false;
            }
            return (
              process.env.NODE_ENV === "development" ||
              (op.direction === "down" && op.result instanceof Error)
            );
          },
        }),
        httpBatchLink({
          headers: () => {
            const headers = new Headers();
            headers.set("x-trpc-source", "nextjs-react");
            return headers;
          },
          transformer: superjson,
          url: getUrl(),
        }),
      ],
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
        {props.children}
      </TRPCProvider>
      {
        // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        process.env.NODE_ENV === "development" &&
        env.NEXT_PUBLIC_REACT_QUERY_DEVTOOLS === "1" ? (
          <ReactQueryDevtools initialIsOpen={false} />
        ) : null
      }
    </QueryClientProvider>
  );
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (TRPCProvider, TRPCReactProvider, useTRPC, useTRPCClient); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable node/no-process-env, unicorn/no-null */
/* oxlint-disable react/only-export-components -- #619: Consumers import TRPCProvider, TRPCReactProvider, useTRPC, useTRPCClient from this existing mixed component, context, or helper API; separating the Fast Refresh boundary remains tracked review debt. */
export { TRPCProvider, TRPCReactProvider, useTRPC, useTRPCClient };
/* oxlint-enable import/no-named-export */
/* oxlint-enable react/only-export-components */
