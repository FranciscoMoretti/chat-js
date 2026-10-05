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

/* oxlint-disable max-lines-per-function, max-params, typescript/prefer-readonly-parameter-types -- max-lines-per-function (#510): optimisticEveMetadata keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-params (#511): optimisticEveMetadata keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
typescript/prefer-readonly-parameter-types (#565): optimisticEveMetadata accepts cache: QueryClient; page; item; current; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
const optimisticEveMetadata = async (
  cache: QueryClient,
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
        // oxlint-disable-next-line oxc/no-map-spread -- #541: React Query updates require fresh page and item objects rather than mutating cached snapshots.
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
  return (): void => {
    for (const [key, previous] of lists) {
      const before = previous?.pages
        .flatMap((page) => page.items)
        .find((item) => item.id === id);
      if (before) {
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
    }
    for (const [key, previous] of details) {
      if (previous?.chatId === id) {
        cache.setQueryData<Identity>(key, (current) =>
          current?.chatId === id
            ? rollbackFields(current, previous, patch)
            : current
        );
      }
    }
  };
};
/* oxlint-enable max-lines-per-function, max-params, typescript/prefer-readonly-parameter-types */
export { optimisticEveMetadata, pendingEveMetadataMutations };
