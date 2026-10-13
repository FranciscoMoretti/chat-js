import type {
  InfiniteData,
  QueryClient,
  QueryKey,
} from "@tanstack/react-query";
import type {
  getEveChatIdentity,
  listEveConversations,
} from "@/lib/db/eve-queries";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

type Identity = Awaited<ReturnType<typeof getEveChatIdentity>>;
type History = InfiniteData<Awaited<ReturnType<typeof listEveConversations>>>;
interface Metadata {
  title: string;
  isPinned: boolean;
}

/**
 * Background title refreshes defer to the last metadata mutation's reconciliation.
 * @param {Readonly<Pick<QueryClient, "isMutating">>} cache Query client whose active mutations share the chat metadata flag.
 * @returns {number} Number of active mutations tagged with eveMetadata, across chat branches.
 */
const pendingEveMetadataMutations = (
  cache: Readonly<Pick<QueryClient, "isMutating">>
): number =>
  cache.isMutating({
    predicate: (mutation: {
      readonly options: { readonly meta?: { readonly eveMetadata?: unknown } };
    }): boolean => mutation.options.meta?.eveMetadata === true,
  });

const rollbackFields = <Value extends Metadata>(
  current: Value,
  previous: Readonly<Metadata>,
  patch: Readonly<Partial<Metadata>>
): Value => ({
  ...current,
  ...(patch.title !== globalThis.undefined && current.title === patch.title
    ? { title: previous.title }
    : {}),
  ...(patch.isPinned !== globalThis.undefined &&
  current.isPinned === patch.isPinned
    ? { isPinned: previous.isPinned }
    : {}),
});

const optimisticEveMetadata = async (
  cache: Readonly<
    Pick<QueryClient, "cancelQueries" | "getQueriesData" | "setQueryData">
  >,
  listKey: QueryKey,
  detailKey: QueryKey,
  id: string,
  patch: Readonly<Partial<Metadata>>
): Promise<() => void> => {
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
        pages: data.pages.map(
          (page: ReadonlyNativeSurface<History["pages"][number]>) => ({
            ...page,
            items: page.items.map(
              (
                item: ReadonlyNativeSurface<
                  History["pages"][number]["items"][number]
                >
              ) => {
                if (item.id === id) {
                  return { ...item, ...patch };
                }
                return item;
              }
            ),
          })
        ),
      });
    }
  }
  for (const [key, data] of details) {
    if (data?.chatId === id) {
      cache.setQueryData(key, { ...data, ...patch });
    }
  }
  // Only restore the affected field; another chat or pin mutation may be in flight.
  return (): void => {
    for (const [key, previous] of lists) {
      const before = previous?.pages
        .flatMap(
          (page: ReadonlyNativeSurface<History["pages"][number]>) => page.items
        )
        .find((item: { readonly id: string }) => item.id === id);
      if (before) {
        cache.setQueryData<History>(
          key,
          (current) =>
            current && {
              ...current,
              pages: current.pages.map(
                (page: ReadonlyNativeSurface<History["pages"][number]>) => ({
                  ...page,
                  items: page.items.map(
                    (
                      item: ReadonlyNativeSurface<
                        History["pages"][number]["items"][number]
                      >
                    ) => {
                      if (item.id === id) {
                        return rollbackFields(item, before, patch);
                      }
                      return item;
                    }
                  ),
                })
              ),
            }
        );
      }
    }
    for (const [key, previous] of details) {
      if (previous?.chatId === id) {
        cache.setQueryData<Identity>(key, (current) => {
          if (current?.chatId === id) {
            return rollbackFields(current, previous, patch);
          }
          return current;
        });
      }
    }
  };
};
export { optimisticEveMetadata, pendingEveMetadataMutations };
