---
name: lazy-prefetch-pattern
description: Use the ChatJS React Query v5 lazy-prefetch pattern without blocking server rendering. Use when prefetching tRPC queries in Next.js Server Components or changing query dehydration and hydration behavior in apps/chat.
---

# Lazy prefetch pattern

Start optional server prefetches early without awaiting them so they can stream
through React hydration without blocking rendering.

- Get the request-scoped query client from `@/trpc/server`.
- Start optional prefetches with
  `void queryClient.prefetchQuery(trpc.foo.bar.queryOptions(...))`.
- Await only data required before rendering.
- Render through the existing `HydrateClient` or `HydrationBoundary`.

This depends on `trpc/query-client.ts` dehydrating pending queries and using
SuperJSON for serialization and hydration. Preserve those settings when using
this pattern.
