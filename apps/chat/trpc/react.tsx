"use client";

/* oxlint-disable import/max-dependencies --
 * import/max-dependencies (#524): import from "@tanstack/react-query" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 */
import { isServer, QueryClientProvider } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import React, { useState } from "react";
import superjson from "superjson";

import { env } from "@/lib/env";
import { getBaseUrl } from "@/lib/url";
import type { AppRouter } from "@/trpc/routers/_app";

import { isAbortedRequest } from "./is-aborted-request";
import { makeQueryClient } from "./query-client";
/* oxlint-enable import/max-dependencies */

const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>();

/* oxlint-disable init-declarations --
 * init-declarations (#507): browserQueryClient assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 */
let browserQueryClient: QueryClient | undefined;
/* oxlint-enable init-declarations */

/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep getQueryClient's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
const getQueryClient = () => {
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
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep getUrl's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
const getUrl = (): string => {
  const base = (() => {
    // oxlint-disable-next-line unicorn/prefer-global-this -- #572: This tests for a browser window; globalThis also exists during server rendering.
    if (typeof window !== "undefined") {
      return "";
    }
    return getBaseUrl();
  })();
  return `${base}/api/trpc`;
};
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-disable node/no-process-env, typescript/prefer-readonly-parameter-types, unicorn/no-null -- node/no-process-env (#537): TRPCReactProvider reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
typescript/prefer-readonly-parameter-types (#565): TRPCReactProvider accepts props: { children: React.ReactNode }; op; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
unicorn/no-null (#570): TRPCReactProvider preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
const TRPCReactProvider = (props: {
  children: React.ReactNode;
}): React.JSX.Element => {
  const queryClient = getQueryClient();

  // oxlint-disable-next-line react/hook-use-state -- A lazy state initializer keeps the client for this provider lifetime; it must never be replaced.
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        loggerLink({
          enabled: (op): boolean => {
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
      {process.env.NODE_ENV === "development" &&
      env.NEXT_PUBLIC_REACT_QUERY_DEVTOOLS === "1" ? (
        <ReactQueryDevtools initialIsOpen={false} />
      ) : null}
    </QueryClientProvider>
  );
};
/* oxlint-enable node/no-process-env, typescript/prefer-readonly-parameter-types, unicorn/no-null */
/* oxlint-disable react/only-export-components -- #619: Consumers import TRPCProvider, TRPCReactProvider, useTRPC, useTRPCClient from this existing mixed component, context, or helper API; separating the Fast Refresh boundary remains tracked review debt. */
export { TRPCProvider, TRPCReactProvider, useTRPC, useTRPCClient };
/* oxlint-enable react/only-export-components */
