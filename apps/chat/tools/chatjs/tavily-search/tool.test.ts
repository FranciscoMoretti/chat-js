import { createUIMessageStream, type UIMessageChunk } from "ai";
import { expect, test, vi } from "vitest";
import type { ChatMessage } from "@/lib/ai/types";
import { createWebSearch } from "./tool";

const { search } = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock("@tavily/core", () => ({ tavily: () => ({ search }) }));
vi.mock("@/lib/env", () => ({ env: { TAVILY_API_KEY: "test-key" } }));
vi.mock("@/lib/utils", () => ({ generateUUID: () => "search-update" }));
test("Tavily forwards native options and preserves source events", async () => {
  search.mockResolvedValue({
    results: [
      { title: "Source", url: "https://example.com", content: "Evidence" },
    ],
  });
  const stream = createUIMessageStream<ChatMessage>({
    execute: async ({ writer }) => {
      const tool = createWebSearch({
        dataStream: writer,
        writeTopLevelUpdates: true,
      });
      const result = await tool.execute?.(
        {
          search_queries: [{ query: "news", maxResults: 3 }],
          topics: ["news"],
          searchDepth: "advanced",
          exclude_domains: ["excluded.com"],
        },
        { toolCallId: "call", messages: [], context: {} }
      );
      expect(result).toMatchObject({
        searches: [
          {
            results: [
              {
                title: "Source",
                url: "https://example.com",
                content: "Evidence",
              },
            ],
          },
        ],
      });
    },
  });
  const events: UIMessageChunk[] = [];
  for await (const event of stream) {
    events.push(event);
  }
  expect(search).toHaveBeenCalledWith(
    "news",
    expect.objectContaining({
      searchDepth: "advanced",
      maxResults: 3,
      topic: "news",
      days: 7,
      excludeDomains: ["excluded.com"],
    })
  );
  expect(events).toContainEqual(
    expect.objectContaining({
      type: "data-researchUpdate",
      data: expect.objectContaining({
        toolCallId: "call",
        type: "web",
        status: "completed",
        results: [expect.objectContaining({ title: "Source", source: "web" })],
      }),
    })
  );
  expect(events.some((event) => event.type === "error")).toBe(false);
});
