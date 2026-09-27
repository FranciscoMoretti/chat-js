import { createRoot } from "react-dom/client";

import { EveSearchResultsView } from "../components/eve/eve-search-results-view";

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
    items: [{ ...item, excerpt: "" }],
    label: "Recent chats",
    query: "",
  },
  { items: [item], label: "Best matches", query: "saffron" },
  {
    items: [
      {
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
createRoot(root).render(
  <main className="grid grid-cols-2 gap-6 p-6">
    {states.map(({ label, ...state }) => (
      <section key={label}>
        <h2 className="mb-2 text-sm font-medium">{label}</h2>
        <div className="bg-popover overflow-hidden rounded-xl border shadow-sm">
          <EveSearchResultsView
            pending={false}
            searching={false}
            error={false}
            isSearch={true}
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
    ))}
  </main>
);
