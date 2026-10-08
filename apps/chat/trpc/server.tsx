// Ensure this file cannot be imported from the client.
import "server-only";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
// oxlint-disable-next-line sort-imports -- Import-order migration debt: the native permutation between @trpc/tanstack-react-query and react still needs a supported server equivalence check; preserve the existing order meanwhile.
import React, { cache } from "react";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";

import { createTRPCContext } from "./init";
import { makeQueryClient } from "./query-client";
// oxlint-disable-next-line sort-imports -- Import-order migration debt: the native permutation between ./query-client and ./routers/_app still needs a supported server equivalence check; preserve the existing order meanwhile.
import { appRouter } from "./routers/_app";

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
