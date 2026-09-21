import { test, vi } from "vitest";

import type * as UrlUtils from "@/lib/url-utils";

import { captureChatStory } from "../_shared/visual";
import { faviconDataUri, webSearchStates } from "../_shared/web-search";
import { WebSearchRenderer as TavilySearchRenderer } from "./renderer";

// Serve an inline favicon so source cards don't capture as broken images.
vi.mock("@/lib/url-utils", async (importOriginal) => ({
  ...(await importOriginal<typeof UrlUtils>()),
  getFaviconUrl: () => faviconDataUri,
}));

test("tavily-search renders every web-search state in the chat", () =>
  captureChatStory(
    "tavily-search",
    webSearchStates(
      (part) => (
        <TavilySearchRenderer
          isReadonly
          messageId="tavily-search-message"
          tool={{
            input: {
              exclude_domains: null,
              searchDepth: null,
              search_queries: [
                { maxResults: null, query: "best espresso machines 2026" },
              ],
              topics: null,
            },
            ...part,
          }}
        />
      ),
      "tavily-search",
      {
        query: { maxResults: 5, query: "best espresso machines 2026" },
        results: [
          {
            content:
              "Our favorite machines for every budget, from single-boiler starters to dual-boiler workhorses.",
            title: "The best espresso machines this year",
            url: "https://www.seriouseats.com/best-espresso-machines",
          },
          {
            content:
              "How dose, yield, and time interact, and what to change first when a shot runs fast or sour.",
            title: "Dialing in espresso: a practical guide",
            url: "https://home.lamarzoccousa.com/dialing-in-espresso",
          },
          {
            content:
              "A study of how grind size shifts extraction yield and perceived strength across roast levels.",
            title: "Extraction yield and grind size in espresso",
            url: "https://arxiv.org/abs/2402.05678",
          },
        ],
      }
    )
  ));
