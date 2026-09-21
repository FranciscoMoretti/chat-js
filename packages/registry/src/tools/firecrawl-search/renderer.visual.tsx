import { test, vi } from "vitest";

import type * as UrlUtils from "@/lib/url-utils";

import { captureChatStory } from "../_shared/visual";
import { webSearchStates } from "../_shared/web-search";
import { WebSearchRenderer as FirecrawlSearchRenderer } from "./renderer";

const baseToolCallId = "firecrawl-search";

// Serve an inline favicon so source cards don't capture as broken images.
vi.mock("@/lib/url-utils", async (importOriginal) => {
  const [original, { faviconDataUri }] = await Promise.all([
    importOriginal<typeof UrlUtils>(),
    import("@/components/web-search-visual-fixture-data"),
  ]);
  return { ...original, getFaviconUrl: () => faviconDataUri };
});

// Feed the real research-update store so the actual ResearchUpdates component
// renders, the way the chat shows a web search. The fixtures are shared with the
// app visual fixture so the two can't drift. The `-loading` tool-call id gets the
// in-progress updates (shimmer + spinner); every other id gets the completed run.
vi.mock("@/lib/stores/hooks-message-parts", async () => {
  const fx = await import("@/components/web-search-visual-fixture-data");
  return {
    useMessageResearchUpdatePartByToolCallId: (
      _messageId: string,
      toolCallId: string
    ) =>
      (toolCallId.endsWith("-loading")
        ? fx.firecrawlResearchUpdatesLoading()
        : fx.firecrawlResearchUpdates()
      ).map((data) => ({ data })),
  };
});

test("firecrawl-search renders every web-search state in the chat", () =>
  captureChatStory(
    "firecrawl-search",
    webSearchStates(
      (toolCallId) => (
        <FirecrawlSearchRenderer
          isReadonly
          messageId="firecrawl-message"
          tool={{
            input: {
              search_queries: [
                { maxResults: null, query: "react server components caching" },
              ],
            },
            output: { searches: [] },
            state: "output-available",
            toolCallId,
          }}
        />
      ),
      baseToolCallId,
      "Caching and Revalidating"
    )
  ));
