// Ensure this file cannot be imported from the client.
import "server-only";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import type { ResolverDef, TRPCQueryOptions } from "@trpc/tanstack-react-query";
import React, { cache } from "react";

import { createTRPCContext } from "./init";
import { preloadQuery } from "./preload-query";
import { makeQueryClient } from "./query-client";
import { appRouter } from "./routers/_app";

// IMPORTANT: Create a stable getter for the query client that
//            will return the same client during the same request.
const getQueryClient = cache(makeQueryClient);

const trpc = createTRPCOptionsProxy({
  ctx: createTRPCContext,
  queryClient: getQueryClient,
  router: appRouter,
});

/* oxlint-disable typescript/prefer-readonly-parameter-types -- typescript/prefer-readonly-parameter-types (#565): HydrateClient accepts props: { children: React.ReactNode }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
const HydrateClient = (props: {
  children: React.ReactNode;
}): React.JSX.Element => {
  const queryClient = getQueryClient();
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {props.children}
    </HydrationBoundary>
  );
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable id-length, no-magic-numbers -- id-length (#506): prefetch uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
no-magic-numbers (#517): prefetch uses 1, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 splitting exports requires an API and Fast Refresh boundary decision. */
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- #593: Preserve concrete query option inference across normal and infinite prefetch overloads.
const prefetch = <T extends ReturnType<TRPCQueryOptions<ResolverDef>>>(
  queryOptions: T
): void => {
  const queryClient = getQueryClient();
  if (queryOptions.queryKey[1]?.type === "infinite") {
    void preloadQuery(
      queryClient.infiniteQuery(
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: Lazy prefetch bridges tagged tRPC query options and TanStack infinite-query overloads; removing the generic adapter requires preserving their correlated types.
        queryOptions as unknown as Parameters<
          typeof queryClient.infiniteQuery
        >[0]
      )
    );
  } else {
    void preloadQuery(queryClient.query(queryOptions));
  }
};
/* oxlint-enable id-length, no-magic-numbers */
/* oxlint-disable react/only-export-components -- #619: Consumers import getQueryClient, HydrateClient, prefetch, trpc from this existing mixed component, context, or helper API; separating the Fast Refresh boundary remains tracked review debt. */
export { getQueryClient, HydrateClient, prefetch, trpc };
/* oxlint-enable react/only-export-components */
