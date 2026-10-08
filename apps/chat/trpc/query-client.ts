import {
  QueryClient,
  defaultShouldDehydrateQuery,
} from "@tanstack/react-query";
import { SuperJSON } from "superjson";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (makeQueryClient); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
const QUERY_STALE_TIME_MS = 60_000;

export const makeQueryClient = (): QueryClient => {
  const queryClient = new QueryClient({
    defaultOptions: {
      dehydrate: {
        serializeData: SuperJSON.serialize,
        shouldDehydrateQuery: (
          // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Pass the original Query to defaultShouldDehydrateQuery; a mapped surface loses the native class private-field identity.
          query
        ): boolean =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
        // Don't redact Next.js server errors; Next relies on them to detect dynamic pages.
        // Next will redact errors with better digests automatically.
        shouldRedactErrors: (): boolean => false,
      },
      hydrate: {
        deserializeData: SuperJSON.deserialize,
      },
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: QUERY_STALE_TIME_MS,
      },
    },
  });
  return queryClient;
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
