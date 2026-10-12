"use client";

import { QueryClientProvider, environmentManager } from "@tanstack/react-query";
import React, { useState } from "react";
import type { AppRouter } from "@/trpc/routers/_app";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
import { createTRPCContext } from "@trpc/tanstack-react-query";

import superjson from "superjson";

import { env } from "@/lib/env";

import { getBaseUrl } from "@/lib/url";

import { isAbortedRequest } from "./is-aborted-request";
import { makeQueryClient } from "./query-client";

const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>();

let browserQueryClient: QueryClient | undefined;

const getQueryClient = (): QueryClient => {
  if (environmentManager.isServer()) {
    // Server: always make a new query client
    return makeQueryClient();
  }
  // Browser: make a new query client if we don't already have one
  // This is very important, so we don't re-make a new client if React
  // suspends during the initial render. This may not be needed if we
  // have a suspense boundary BELOW the creation of the query client
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
};

const getUrl = (): string => {
  const base = ((): string => {
    if (typeof window !== "undefined") {
      return "";
    }
    return getBaseUrl();
  })();
  return `${base}/api/trpc`;
};
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
      {process.env.NODE_ENV === "development" &&
      env.NEXT_PUBLIC_REACT_QUERY_DEVTOOLS === "1" ? (
        <ReactQueryDevtools initialIsOpen={false} />
      ) : null}
    </QueryClientProvider>
  );
};
export { TRPCProvider, TRPCReactProvider, useTRPC, useTRPCClient };
