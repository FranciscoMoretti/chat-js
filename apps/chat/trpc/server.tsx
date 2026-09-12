import "server-only"; // <-- ensure this file cannot be imported from the client
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import type { ResolverDef, TRPCQueryOptions } from "@trpc/tanstack-react-query";
import { cache } from "react";

import { createTRPCContext } from "./init";
import { makeQueryClient } from "./query-client";
import { appRouter } from "./routers/_app";

// IMPORTANT: Create a stable getter for the query client that
//            will return the same client during the same request.
export const getQueryClient = cache(makeQueryClient);

export const trpc = createTRPCOptionsProxy({
  ctx: createTRPCContext,
  queryClient: getQueryClient,
  router: appRouter,
});

export const HydrateClient = (props: { children: React.ReactNode }) => {
  const queryClient = getQueryClient();
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {props.children}
    </HydrationBoundary>
  );
};

export const prefetch = <T extends ReturnType<TRPCQueryOptions<ResolverDef>>>(
  queryOptions: T
) => {
  const queryClient = getQueryClient();
  if (queryOptions.queryKey[1]?.type === "infinite") {
    queryClient.prefetchInfiniteQuery(
      queryOptions as unknown as Parameters<
        typeof queryClient.prefetchInfiniteQuery
      >[0]
    );
  } else {
    queryClient.prefetchQuery(queryOptions);
  }
};
