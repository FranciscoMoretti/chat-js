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
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading eveMetadata from mutation.options.meta; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    }): boolean => mutation.options.meta?.eveMetadata === true,
  });

const rollbackFields = <Value extends Metadata>(
  current: Value,
  previous: Readonly<Metadata>,
  patch: Readonly<Partial<Metadata>>
): Value => ({
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing current own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  ...current,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Conditional spread (patch.title !== globalThis.undefined && current.title === patch.title     ? { title: previous.title }     : {}) preserves the selected branch's own keys/values and positional overrides, including absent keys when a branch contributes none; pinned eslint/prefer-object-spread rejects Object.assign.
  ...(patch.title !== globalThis.undefined && current.title === patch.title
    ? { title: previous.title }
    : {}),
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Conditional spread (patch.isPinned !== globalThis.undefined &&   current.isPinned === patch.isPinned     ? { isPinned: previous.isPinned }     : {}) preserves the selected branch's own keys/values and positional overrides, including absent keys when a branch contributes none; pinned eslint/prefer-object-spread rejects Object.assign.
  ...(patch.isPinned !== globalThis.undefined &&
  current.isPinned === patch.isPinned
    ? { isPinned: previous.isPinned }
    : {}),
});

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve optimisticEveMetadata's awaited sequencing and rejected-Promise behavior. */
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
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing data own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...data,
        // oxlint-disable-next-line oxc/no-map-spread -- #541: React Query updates require fresh page and item objects rather than mutating cached snapshots.
        pages: data.pages.map((page) => ({
          // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing page own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
          ...page,
          items: page.items.map((item) =>
            // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing item own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement. Keep the existing patch own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
            item.id === id ? { ...item, ...patch } : item
          ),
        })),
      });
    }
  }
  for (const [key, data] of details) {
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading chatId from data; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    if (data?.chatId === id) {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing data own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement. Keep the existing patch own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      cache.setQueryData(key, { ...data, ...patch });
    }
  }
  // Only restore the affected field; another chat or pin mutation may be in flight.
  return (): void => {
    for (const [key, previous] of lists) {
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading pages from previous; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      const before = previous?.pages
        .flatMap((page) => page.items)
        .find((item) => item.id === id);
      if (before) {
        cache.setQueryData<History>(
          key,
          (current) =>
            current && {
              // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing current own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
              ...current,
              pages: current.pages.map((page) => ({
                // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing page own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading chatId from previous; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      if (previous?.chatId === id) {
        cache.setQueryData<Identity>(key, (current) =>
          // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading chatId from current; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
          current?.chatId === id
            ? rollbackFields(current, previous, patch)
            : current
        );
      }
    }
  };
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (optimisticEveMetadata, pendingEveMetadataMutations); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-params, typescript/prefer-readonly-parameter-types */
export { optimisticEveMetadata, pendingEveMetadataMutations };
/* oxlint-enable import/no-named-export */
