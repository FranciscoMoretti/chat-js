/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
/* oxlint-disable import/no-namespace -- The type-only namespace import names the module the mock replaces. */
/* oxlint-disable import/no-relative-parent-imports -- Stories import the shared harness from the sibling _shared directory. */
/* oxlint-disable oxc/no-async-await -- Captures await rendering, fonts and animations in a fixed order. */
/* oxlint-disable oxc/no-rest-spread-properties -- Copying these properties preserves immutable updates and the existing structural API without mutating the source object. */
/* oxlint-disable react-perf/jsx-no-new-object-as-prop -- Each story renders once per capture; memoizing fixture props would only add noise. */
/* oxlint-disable typescript/explicit-function-return-type -- Return types are inferred from the fixtures and helpers they wrap. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- Parameters are DOM elements and library props, which are mutable host objects. */
/* oxlint-disable typescript/promise-function-async -- Test and settle callbacks return the capture promise directly. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */

import React from "react";
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
/* oxlint-enable unicorn/no-null */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable react-perf/jsx-no-new-object-as-prop */
/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-enable import/no-namespace */
/* oxlint-enable eslint/sort-imports */
