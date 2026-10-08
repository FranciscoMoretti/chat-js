// Ensure this file cannot be imported from the client.
/* oxlint-disable sort-imports -- Preserve runtime import evaluation order and pinned Oxfmt type/binding grouping; native alphabetical ordering conflicts with that grouping. */
import "server-only";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import React, { cache } from "react";

/* oxlint-disable sort-imports -- These type-only reader imports extend the existing runtime import groups; preserve module evaluation order and the formatter grouping. */
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";

import { createTRPCContext } from "./init";
import { makeQueryClient } from "./query-client";
/* oxlint-enable sort-imports */
// oxlint-disable-next-line eslint/sort-imports -- Preserve runtime module evaluation order and keep type-only declarations beside the owning module; the pinned binding-order rule requires a different grouping.
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

const HydrateClient = (props: {
  readonly children: ReadonlyReactNode;
}): React.JSX.Element => {
  const queryClient = getQueryClient();
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {props.children}
    </HydrationBoundary>
  );
};

/* oxlint-disable react/only-export-components -- #619: Consumers import getQueryClient, HydrateClient, trpc from this existing mixed component, context, or helper API; separating the Fast Refresh boundary remains tracked review debt. */
// oxlint-disable-next-line import/no-named-export -- Keep the established named server API; no-default-export rejects its default-export alternative.
export { getQueryClient, HydrateClient, trpc };
/* oxlint-enable react/only-export-components */
