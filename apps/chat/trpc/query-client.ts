import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from "@tanstack/react-query";
import { SuperJSON } from "superjson";

/* oxlint-disable no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types --
 * no-magic-numbers (#517): makeQueryClient uses 60, 1000 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/explicit-function-return-type (#560): Keep makeQueryClient's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep makeQueryClient's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): makeQueryClient accepts query; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const makeQueryClient = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      dehydrate: {
        serializeData: SuperJSON.serialize,
        shouldDehydrateQuery: (query): boolean =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
        // Don't redact Next.js server errors; Next relies on them to detect dynamic pages.
        // Next will redact errors with better digests automatically.
        shouldRedactErrors: () => false,
      },
      hydrate: {
        deserializeData: SuperJSON.deserialize,
      },
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 60 * 1000,
      },
    },
  });
  return queryClient;
};
/* oxlint-enable no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
