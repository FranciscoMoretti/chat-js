import { expect, test, vi } from "vitest";

import { createToolResult } from "@/lib/eve/tool-result";

import { multiQueryWebSearchStep } from "./multi-query-web-search";

test("search receipts snapshot declared query fields and exclude provider metadata", async () => {
  const query = {
    maxResults: 2,
    providerMetadata: { secret: "private" },
    query: "saffron recipes",
  };
  const search = vi.fn().mockResolvedValue([
    {
      content: "Toast gently.",
      title: "Recipe",
      url: "https://example.test",
    },
  ]);
  const receipt = createToolResult(
    await multiQueryWebSearchStep({
      queries: [query],
      search,
      toolCallId: "search-call",
    }),
    0
  );
  query.maxResults = 1;
  query.query = "edited after execution";

  expect(receipt.output).toEqual({
    searches: [
      {
        query: { maxResults: 2, query: "saffron recipes" },
        results: [
          {
            content: "Toast gently.",
            title: "Recipe",
            url: "https://example.test",
          },
        ],
      },
    ],
  });
});
