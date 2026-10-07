// Ensure this file cannot be imported from the client.
import "server-only";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import type { ResolverDef, TRPCQueryOptions } from "@trpc/tanstack-react-query";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import React, { cache } from "react";
/* oxlint-enable sort-imports */

import { createTRPCContext } from "./init";
import { preloadQuery } from "./preload-query";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { makeQueryClient } from "./query-client";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { appRouter } from "./routers/_app";
/* oxlint-enable sort-imports */

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
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading type from queryOptions.queryKey[1]; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (getQueryClient, HydrateClient, prefetch, trpc); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable id-length, no-magic-numbers */
/* oxlint-disable react/only-export-components -- #619: Consumers import getQueryClient, HydrateClient, prefetch, trpc from this existing mixed component, context, or helper API; separating the Fast Refresh boundary remains tracked review debt. */
export { getQueryClient, HydrateClient, prefetch, trpc };
/* oxlint-enable import/no-named-export */
/* oxlint-enable react/only-export-components */
