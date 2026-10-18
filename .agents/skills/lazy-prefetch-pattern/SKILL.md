---
name: lazy-prefetch-pattern
description: Use the ChatJS React Query v5 lazy-prefetch pattern without blocking server rendering. Use when prefetching tRPC queries in Next.js Server Components or changing query dehydration and hydration behavior in apps/chat.
---

# Lazy prefetch pattern

Start optional server prefetches early without awaiting them so they can stream through React hydration without blocking rendering.

- Import `preloadQuery` from `@/trpc/preload-query` and use the request-cached `getQueryClient()` from `@/trpc/server` for consumers beneath `HydrateClient`.
- For normal queries, pass `queryClient.query(trpc.foo.bar.queryOptions(...))` to `preloadQuery`. For infinite queries, use `queryClient.infiniteQuery(trpc.foo.list.infiniteQueryOptions(...))`, including the procedure's cursor and `getNextPageParam` options.
- Start optional preloads with `void preloadQuery(...)`. The helper handles caller-facing rejection; the cache retains query errors. An already-dehydrated pending promise can still reject.
- Guard conditional preloads before invoking them. Imperative fetching does not honor `enabled: false` as a skip, and invoking `skipToken` options produces a missing-query-function error.
- Preserve existing awaited settings preloads and deliberately isolated query clients. A custom `HydrationBoundary` must dehydrate the same client used for its preloads.

```tsx
import { preloadQuery } from "@/trpc/preload-query";
import { getQueryClient, trpc } from "@/trpc/server";

const queryClient = getQueryClient();
void preloadQuery(
  queryClient.query(trpc.settings.getModelPreferences.queryOptions())
);
```

Render the consumers beneath the matching hydration boundary. `query()` applies any `select` callback while the cache retains the raw result; selector failures are handled by `preloadQuery` too.

This depends on `trpc/query-client.ts` dehydrating pending queries and using SuperJSON for serialization and hydration. Preserve those settings when using this pattern.
