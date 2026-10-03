"use client";

/* oxlint-disable import/max-dependencies, sort-imports --
 * import/max-dependencies (#524): import from "@tanstack/react-query" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
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
/* oxlint-enable import/max-dependencies, sort-imports */

/* oxlint-disable import/exports-last, import/group-exports, import/no-named-export, react/only-export-components --
 * import/exports-last (#522): { TRPCProvider, useTRPC, useTRPCClient } is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): { TRPCProvider, useTRPC, useTRPCClient } stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named { TRPCProvider, useTRPC, useTRPCClient } API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * react/only-export-components (#553): { TRPCProvider, useTRPC, useTRPCClient } is part of a module that also exposes related helpers or framework data; splitting exports requires an API and Fast Refresh boundary decision.
 */
export const { TRPCProvider, useTRPC, useTRPCClient } =
  createTRPCContext<AppRouter>();
/* oxlint-enable import/exports-last, import/group-exports, import/no-named-export, react/only-export-components */

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
/* oxlint-disable import/group-exports, import/no-named-export, no-ternary, node/no-process-env, typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * import/group-exports (#523): TRPCReactProvider stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named TRPCReactProvider API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-ternary (#518): TRPCReactProvider derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * node/no-process-env (#537): TRPCReactProvider reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 * typescript/prefer-readonly-parameter-types (#565): TRPCReactProvider accepts props: { children: React.ReactNode }; op; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): TRPCReactProvider preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
export const TRPCReactProvider = (props: {
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
/* oxlint-enable import/group-exports, import/no-named-export, no-ternary, node/no-process-env, typescript/prefer-readonly-parameter-types, unicorn/no-null */
