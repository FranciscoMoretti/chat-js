import { test, vi } from "vitest";

import type * as UrlUtils from "@/lib/url-utils";

import { captureChatStory } from "../_shared/visual";
import { faviconDataUri, webSearchStates } from "../_shared/web-search";
import { WebSearchRenderer as FirecrawlSearchRenderer } from "./renderer";

// Serve an inline favicon so source cards don't capture as broken images.
vi.mock("@/lib/url-utils", async (importOriginal) => ({
  ...(await importOriginal<typeof UrlUtils>()),
  getFaviconUrl: () => faviconDataUri,
}));

test("firecrawl-search renders every web-search state in the chat", () =>
  captureChatStory(
    "firecrawl-search",
    webSearchStates(
      (part) => (
        <FirecrawlSearchRenderer
          isReadonly
          messageId="firecrawl-search-message"
          tool={{
            input: {
              search_queries: [
                { maxResults: null, query: "react server components caching" },
              ],
            },
            ...part,
          }}
        />
      ),
      "firecrawl-search",
      {
        query: { maxResults: 5, query: "react server components caching" },
        results: [
          {
            content:
              "Next.js caches fetch() results and route segments by default; revalidate on a timer or on demand.",
            title: "Caching and Revalidating – Next.js",
            url: "https://nextjs.org/docs/app/building-your-application/caching",
          },
          {
            content:
              "Server Components render on the server and stream to the client, cutting bundle size and enabling direct data access.",
            title: "Understanding React Server Components",
            url: "https://vercel.com/blog/understanding-react-server-components",
          },
          {
            content:
              "A measurement of time-to-first-byte improvements from streaming SSR across 40 production apps.",
            title: "Streaming SSR performance in practice",
            url: "https://arxiv.org/abs/2401.01234",
          },
        ],
      }
    )
  ));
