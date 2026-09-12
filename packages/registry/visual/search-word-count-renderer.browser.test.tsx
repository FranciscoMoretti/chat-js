import { takeSnapshot } from "@uiverify/vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import { WebSearchRenderer as FirecrawlSearchRenderer } from "../src/tools/firecrawl-search/renderer";
import { WebSearchRenderer as TavilySearchRenderer } from "../src/tools/tavily-search/renderer";
import { WordCountRenderer } from "../src/tools/word-count/renderer";

import "../../../apps/chat/app/globals.css";

vi.mock("@/components/part/message-annotations", () => ({
  ResearchUpdates: () => <span>Search updates</span>,
}));

vi.mock("@/lib/stores/hooks-message-parts", () => ({
  useMessageResearchUpdatePartByToolCallId: () => [{ data: {} }],
}));

test("search and word-count renderers preserve their visible states", async () => {
  const container = document.createElement("main");
  document.documentElement.classList.add("dark");
  container.style.cssText =
    "padding:24px;background:#171717;width:700px;display:grid;gap:16px";
  document.body.append(container);
  const root = createRoot(container);

  await act(() => {
    root.render(
      <>
        <section data-testid="firecrawl-search">
          <FirecrawlSearchRenderer
            isReadonly
            messageId="firecrawl-message"
            tool={{
              input: {
                search_queries: [{ maxResults: null, query: "latest news" }],
              },
              state: "input-available",
              toolCallId: "firecrawl-search",
            }}
          />
        </section>
        <section data-testid="tavily-search">
          <TavilySearchRenderer
            isReadonly
            messageId="tavily-message"
            tool={{
              input: {
                exclude_domains: null,
                searchDepth: null,
                search_queries: [{ maxResults: null, query: "latest news" }],
                topics: null,
              },
              output: { searches: [] },
              state: "output-available",
              toolCallId: "tavily-search",
            }}
          />
        </section>
        <section data-testid="word-count-loading">
          <WordCountRenderer
            isReadonly
            messageId="word-count-message"
            tool={{
              input: { text: "one two three" },
              state: "input-available",
              toolCallId: "word-count-loading",
            }}
          />
        </section>
        <section data-testid="word-count-output">
          <WordCountRenderer
            isReadonly
            messageId="word-count-message"
            tool={{
              input: { text: "one two three" },
              output: {
                characters: 13,
                charactersNoSpaces: 11,
                sentences: 1,
                words: 3,
              },
              state: "output-available",
              toolCallId: "word-count-output",
            }}
          />
        </section>
        <section data-testid="word-count-error">
          <WordCountRenderer
            isReadonly
            messageId="word-count-message"
            tool={{
              errorText: "Tool unavailable",
              state: "output-error",
              toolCallId: "word-count-error",
            }}
          />
        </section>
      </>
    );
  });

  expect(
    container.querySelector("[data-testid=word-count-error]")?.textContent
  ).toBe("");
  expect(container.textContent).toContain("Counting words...");
  expect(container.textContent).toContain("No spaces");
  expect(container.textContent).toContain("Search updates");
  await takeSnapshot("search-and-word-count-renderers");
  await act(() => root.unmount());
  container.remove();
});
