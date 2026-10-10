/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../components/eve/eve-search-results-view" dependency within this package instead of introducing an alias or barrel API.
 */
import React from "react";
import { createRoot } from "react-dom/client";

// oxlint-disable-next-line sort-imports -- Oxfmt groups this type reader import by module; sort-imports requires a different binding-name or syntax order.
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { EveSearchResultsView } from "../components/eve/eve-search-results-view";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */

const item = {
  conversationId: "branch",
  excerpt:
    "Try ⟦saffron⟧ in the rice. Toast it gently before adding the broth.",
  id: "chat",
  title: "Weekend dinner ideas",
};
const states = [
  {
    isSearch: false,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing item own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    items: [{ ...item, excerpt: "" }],
    label: "Recent chats",
    query: "",
  },
  { items: [item], label: "Best matches", query: "saffron" },
  {
    items: [
      {
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing item own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...item,
        excerpt: "Hello ⟦Worl⟧d! How can I help you today?",
        title: "Hello World",
      },
    ],
    label: "Prefix match",
    query: "worl",
  },
  {
    items: [
      {
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing item own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...item,
        excerpt: "⟦Hello⟧! How can I help you today?",
        title: "Friendly Hello Chat",
      },
    ],
    label: "Assistant message match",
    query: "hello",
  },
  {
    items: [],
    label: "Waiting for current query",
    pending: true,
    query: "saffron rice",
    searching: true,
  },
  { items: [], label: "No matches", query: "unicorn" },
  { items: [], label: "First load", pending: true, query: "", searching: true },
  { error: true, items: [], label: "Retry", query: "saffron" },
  { isSearch: false, items: [], label: "Empty history", query: "" },
  { hasMore: true, items: [item], label: "Pagination", query: "saffron" },
];
const root = document.querySelector("#root");
if (!root) {
  throw new Error("Missing fixture root");
}
/* oxlint-disable react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/jsx-props-no-spreading -- react-perf/jsx-no-new-function-as-prop (#557): createRoot(root).render creates render-local values that capture current state; memoization needs dependency and consumer-identity review rather than unconditional hoisting.
react/jsx-max-depth (#548): createRoot(root).render keeps related fixture render states together; extraction changes component, state, and layout boundaries.
react/jsx-props-no-spreading (#550): createRoot(root).render forwards its typed component props; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration. */

createRoot(root).render(
  <main className="grid grid-cols-2 gap-6 p-6">
    {states.map(
      (
        /* oxlint-disable oxc/no-rest-spread-properties -- Rest binding state excludes label from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract. */
        { label, ...state }: ReadonlyNativeSurface<(typeof states)[number]>
        /* oxlint-enable oxc/no-rest-spread-properties */
      ) => (
        <section key={label}>
          <h2 className="mb-2 text-sm font-medium">{label}</h2>
          <div className="bg-popover overflow-hidden rounded-xl border shadow-sm">
            <EveSearchResultsView
              pending={false}
              searching={false}
              error={false}
              isSearch
              hasMore={false}
              loadingMore={false}
              disableLoadMore={false}
              onClose={() => {
                /* Static gallery: closing is tested in the real dialog. */
              }}
              onQueryChange={() => {
                /* Static gallery: interactions are tested in the real dialog. */
              }}
              onSelect={() => {
                /* Static gallery: interactions are tested in the real dialog. */
              }}
              onRetry={() => {
                /* Static gallery: interactions are tested in the real dialog. */
              }}
              onLoadMore={() => {
                /* Static gallery: interactions are tested in the real dialog. */
              }}
              {...state}
            />
          </div>
        </section>
      )
    )}
  </main>
);
/* oxlint-enable react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/jsx-props-no-spreading */
