/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
// Ensure this file cannot be imported from the client.
import "server-only";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import type { ResolverDef, TRPCQueryOptions } from "@trpc/tanstack-react-query";
import React, { cache } from "react";

import { createTRPCContext } from "./init";
import { makeQueryClient } from "./query-client";
import { appRouter } from "./routers/_app";
/* oxlint-enable sort-imports */

/* oxlint-disable import/group-exports, import/no-named-export, react/only-export-components --
 * import/group-exports (#523): getQueryClient stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named getQueryClient API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * react/only-export-components (#553): getQueryClient is part of a module that also exposes related helpers or framework data; splitting exports requires an API and Fast Refresh boundary decision.
 */
// IMPORTANT: Create a stable getter for the query client that
//            will return the same client during the same request.
export const getQueryClient = cache(makeQueryClient);
/* oxlint-enable import/group-exports, import/no-named-export, react/only-export-components */

/* oxlint-disable import/group-exports, import/no-named-export, react/only-export-components --
 * import/group-exports (#523): trpc stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named trpc API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * react/only-export-components (#553): trpc is part of a module that also exposes related helpers or framework data; splitting exports requires an API and Fast Refresh boundary decision.
 */
export const trpc = createTRPCOptionsProxy({
  ctx: createTRPCContext,
  queryClient: getQueryClient,
  router: appRouter,
});
/* oxlint-enable import/group-exports, import/no-named-export, react/only-export-components */

/* oxlint-disable import/group-exports, import/no-named-export, typescript/prefer-readonly-parameter-types --
 * import/group-exports (#523): HydrateClient stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named HydrateClient API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): HydrateClient accepts props: { children: React.ReactNode }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const HydrateClient = (props: {
  children: React.ReactNode;
}): React.JSX.Element => {
  const queryClient = getQueryClient();
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {props.children}
    </HydrationBoundary>
  );
};
/* oxlint-enable import/group-exports, import/no-named-export, typescript/prefer-readonly-parameter-types */

/* oxlint-disable id-length, import/group-exports, import/no-named-export, no-magic-numbers, oxc/no-optional-chaining, react/only-export-components --
 * id-length (#506): prefetch uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * import/group-exports (#523): prefetch stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named prefetch API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): prefetch uses 1, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-optional-chaining (#542): prefetch handles optional queryOptions.queryKey[1]?.type without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * react/only-export-components (#553): prefetch is part of a module that also exposes related helpers or framework data; splitting exports requires an API and Fast Refresh boundary decision.
 */
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- #593: Preserve concrete query option inference across normal and infinite prefetch overloads.
export const prefetch = <T extends ReturnType<TRPCQueryOptions<ResolverDef>>>(
  queryOptions: T
): void => {
  const queryClient = getQueryClient();
  if (queryOptions.queryKey[1]?.type === "infinite") {
    // oxlint-disable-next-line typescript/no-deprecated -- #583: Keep the v5 prefetch API and its error-swallowing hydration semantics across locked and freshly scaffolded Query versions.
    void queryClient.prefetchInfiniteQuery(
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: Lazy prefetch bridges tagged tRPC query options and TanStack infinite-query overloads; removing the generic adapter requires preserving their correlated types.
      queryOptions as unknown as Parameters<
        // oxlint-disable-next-line typescript/no-deprecated -- #583: Keep the v5 prefetch API and its error-swallowing hydration semantics across locked and freshly scaffolded Query versions.
        typeof queryClient.prefetchInfiniteQuery
      >[0]
    );
  } else {
    // oxlint-disable-next-line typescript/no-deprecated -- #583: Keep the v5 prefetch API and its error-swallowing hydration semantics across locked and freshly scaffolded Query versions.
    void queryClient.prefetchQuery(queryOptions);
  }
};
/* oxlint-enable id-length, import/group-exports, import/no-named-export, no-magic-numbers, oxc/no-optional-chaining, react/only-export-components */
