// Ensure this file cannot be imported from the client.
import "server-only";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import React, { cache } from "react";

import { createTRPCContext } from "./init";
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

/* oxlint-disable react/only-export-components -- #619: Consumers import getQueryClient, HydrateClient, trpc from this existing mixed component, context, or helper API; separating the Fast Refresh boundary remains tracked review debt. */
export { getQueryClient, HydrateClient, trpc };
/* oxlint-enable react/only-export-components */
