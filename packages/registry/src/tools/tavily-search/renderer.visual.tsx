import { test, vi } from "vitest";

import type * as UrlUtils from "@/lib/url-utils";

import { captureChatStory } from "../_shared/visual";
import { webSearchStates } from "../_shared/web-search";
import { WebSearchRenderer as TavilySearchRenderer } from "./renderer";

const baseToolCallId = "tavily-search";

// Serve an inline favicon so source cards don't capture as broken images.
vi.mock("@/lib/url-utils", async (importOriginal) => {
  const [original, { faviconDataUri }] = await Promise.all([
    importOriginal<typeof UrlUtils>(),
    import("@/components/web-search-visual-fixture-data"),
  ]);
  return { ...original, getFaviconUrl: () => faviconDataUri };
});

// Feed the real research-update store so the actual ResearchUpdates component
// renders. Distinct queries/results from firecrawl (shared fixture module) so the
// two snapshots are visually distinguishable. The `-loading` tool-call id gets the
// in-progress updates (shimmer + spinner); every other id gets the completed run.
vi.mock("@/lib/stores/hooks-message-parts", async () => {
  const fx = await import("@/components/web-search-visual-fixture-data");
  return {
    useMessageResearchUpdatePartByToolCallId: (
      _messageId: string,
      toolCallId: string
    ) =>
      (toolCallId.endsWith("-loading")
        ? fx.tavilyResearchUpdatesLoading()
        : fx.tavilyResearchUpdates()
      ).map((data) => ({ data })),
  };
});

test("tavily-search renders every web-search state in the chat", () =>
  captureChatStory(
    "tavily-search",
    webSearchStates(
      (toolCallId) => (
        <TavilySearchRenderer
          isReadonly
          messageId="tavily-message"
          tool={{
            input: {
              exclude_domains: null,
              searchDepth: null,
              search_queries: [
                { maxResults: null, query: "best espresso machines 2026" },
              ],
              topics: null,
            },
            output: { searches: [] },
            state: "output-available",
            toolCallId,
          }}
        />
      ),
      baseToolCallId,
      "The best espresso machines this year"
    )
  ));
