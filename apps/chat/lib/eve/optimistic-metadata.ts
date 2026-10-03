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
/* oxlint-disable typescript/consistent-type-definitions --
 * typescript/consistent-type-definitions (#559): Metadata preserves its current alias/interface semantics; declaration merging and implicit index-signature assignability differ between those forms.
 */
type Metadata = { title: string; isPinned: boolean };
/* oxlint-enable typescript/consistent-type-definitions */

/* oxlint-disable import/exports-last, import/group-exports, jsdoc/require-param, jsdoc/require-returns, typescript/prefer-readonly-parameter-types --
 * import/exports-last (#522): pendingEveMetadataMutations is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): pendingEveMetadataMutations stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): pendingEveMetadataMutations's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): pendingEveMetadataMutations's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * typescript/prefer-readonly-parameter-types (#565): pendingEveMetadataMutations accepts cache: QueryClient; mutation; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/** Background title refreshes defer to the last metadata mutation's reconciliation. */
export const pendingEveMetadataMutations = (cache: QueryClient): number =>
  cache.isMutating({
    predicate: (mutation): boolean =>
      mutation.options.meta?.eveMetadata === true,
  });
/* oxlint-enable import/exports-last, import/group-exports, jsdoc/require-param, jsdoc/require-returns, typescript/prefer-readonly-parameter-types */

/* oxlint-disable id-length, no-undefined, typescript/prefer-readonly-parameter-types --
 * id-length (#506): rollbackFields uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * no-undefined (#519): rollbackFields uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/prefer-readonly-parameter-types (#565): rollbackFields accepts previous: Metadata; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable id-length, no-undefined, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, max-lines-per-function, max-params, no-continue, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types --
 * import/group-exports (#523): optimisticEveMetadata stays exported at its declaration so its public contract is visible beside its implementation.
 * max-lines-per-function (#510): optimisticEveMetadata keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-params (#511): optimisticEveMetadata keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-continue (#515): optimisticEveMetadata skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 * typescript/explicit-function-return-type (#560): Keep optimisticEveMetadata's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep optimisticEveMetadata's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): optimisticEveMetadata accepts cache: QueryClient; page; item; current; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable import/group-exports, max-lines-per-function, max-params, no-continue, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
