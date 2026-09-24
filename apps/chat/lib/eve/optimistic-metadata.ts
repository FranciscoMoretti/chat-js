import type {
  InfiniteData,
  QueryClient,
  QueryKey,
} from "@tanstack/react-query";

import type {
  getEveChatIdentity,
  listEveConversations,
} from "@/lib/db/eve-queries";

type Identity = Awaited<ReturnType<typeof getEveChatIdentity>>;
type History = InfiniteData<Awaited<ReturnType<typeof listEveConversations>>>;
type Metadata = { title: string; isPinned: boolean };

/** Background title refreshes defer to the last metadata mutation's reconciliation. */
export const pendingEveMetadataMutations = (cache: QueryClient) =>
  cache.isMutating({
    predicate: (mutation) => mutation.options.meta?.eveMetadata === true,
  });

const rollbackFields = <T extends Metadata>(
  current: T,
  previous: Metadata,
  patch: Partial<Metadata>
): T => ({
  ...current,
  ...(patch.title !== undefined && current.title === patch.title
    ? { title: previous.title }
    : {}),
  ...(patch.isPinned !== undefined && current.isPinned === patch.isPinned
    ? { isPinned: previous.isPinned }
    : {}),
});

export const optimisticEveMetadata = async (
  cache: QueryClient,
  listKey: QueryKey,
  detailKey: QueryKey,
  id: string,
  patch: Partial<Metadata>
) => {
  await Promise.all([
    cache.cancelQueries({ queryKey: listKey }),
    cache.cancelQueries({ queryKey: detailKey }),
  ]);
  const lists = cache.getQueriesData<History>({ queryKey: listKey });
  const details = cache.getQueriesData<Identity>({ queryKey: detailKey });
  for (const [key, data] of lists) {
    if (data) {
      cache.setQueryData(key, {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          items: page.items.map((item) =>
            item.id === id ? { ...item, ...patch } : item
          ),
        })),
      });
    }
  }
  for (const [key, data] of details) {
    if (data?.chatId === id) {
      cache.setQueryData(key, { ...data, ...patch });
    }
  }
  // Only restore the affected field; another chat or pin mutation may be in flight.
  return () => {
    for (const [key, previous] of lists) {
      const before = previous?.pages
        .flatMap((page) => page.items)
        .find((item) => item.id === id);
      if (!before) {
        continue;
      }
      cache.setQueryData<History>(
        key,
        (current) =>
          current && {
            ...current,
            pages: current.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                item.id === id ? rollbackFields(item, before, patch) : item
              ),
            })),
          }
      );
    }
    for (const [key, previous] of details) {
      if (previous?.chatId !== id) {
        continue;
      }
      cache.setQueryData<Identity>(key, (current) =>
        current?.chatId === id
          ? rollbackFields(current, previous, patch)
          : current
      );
    }
  };
};
