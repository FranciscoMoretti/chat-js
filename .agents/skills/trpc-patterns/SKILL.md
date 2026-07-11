---
name: trpc-patterns
description: Implement ChatJS tRPC routers, TanStack Query hooks, mutations, and cache invalidation. Use when adding or changing tRPC procedures or their React consumers in apps/chat.
---

# ChatJS tRPC patterns

## Backend

- Add feature routers under `apps/chat/trpc/routers/*.router.ts` and register
  them in `apps/chat/trpc/routers/_app.ts`.
- Use `protectedProcedure` for authenticated operations.
- Validate inputs with Zod and verify ownership before mutations.
- Keep database access in `apps/chat/lib/db/queries.ts`.

## React queries

Use `useTRPC()` with TanStack Query:

```tsx
const trpc = useTRPC();
const query = useQuery({
  ...trpc.feature.list.queryOptions(),
  enabled: Boolean(condition),
});
```

For mutations, use generated mutation options and invalidate related keys after
success:

```tsx
const trpc = useTRPC();
const queryClient = useQueryClient();

const mutation = useMutation(
  trpc.feature.update.mutationOptions({
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: trpc.feature.list.queryKey(),
      }),
  })
);
```

Handle loading and error states in the consumer.
