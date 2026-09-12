import { asSchema, createUIMessageStream } from "ai";
import type { UIMessageChunk } from "ai";
import { expect, test, vi } from "vitest";

import type { ChatMessage } from "@/lib/ai/types";

import { webSearch } from "./tool";

const { search } = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock("@tavily/core", () => ({ tavily: () => ({ search }) }));
vi.mock("@/lib/env", () => ({ env: { TAVILY_API_KEY: "test-key" } }));
vi.mock("@/lib/utils", () => ({ generateUUID: () => "search-update" }));
test("Tavily forwards native options and preserves source events", async () => {
  search.mockResolvedValue({
    results: [
      { content: "Evidence", title: "Source", url: "https://example.com" },
    ],
  });
  const stream = createUIMessageStream<ChatMessage>({
    execute: async ({ writer }) => {
      const tool = webSearch;
      const context = { dataStream: writer, writeTopLevelUpdates: true };
      const result = await tool.execute?.(
        {
          exclude_domains: ["excluded.com"],
          searchDepth: "advanced",
          search_queries: [{ query: "news", maxResults: 3 }],
          topics: ["news"],
        },
        { context, messages: [], toolCallId: "call" }
      );
      expect(result).toMatchObject({
        searches: [
          {
            results: [
              {
                content: "Evidence",
                title: "Source",
                url: "https://example.com",
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
      days: 7,
      excludeDomains: ["excluded.com"],
      maxResults: 3,
      searchDepth: "advanced",
      topic: "news",
    })
  );
  expect(events).toContainEqual(
    expect.objectContaining({
      data: expect.objectContaining({
        toolCallId: "call",
        type: "web",
        status: "completed",
        results: [expect.objectContaining({ title: "Source", source: "web" })],
      }),
      type: "data-researchUpdate",
    })
  );
  expect(events.some((event) => event.type === "error")).toBe(false);
});

test("strict tool fields remain required and explicit nulls apply defaults", async () => {
  search.mockResolvedValue({ results: [] });
  const stream = createUIMessageStream<ChatMessage>({
    execute: async ({ writer }) => {
      const tool = webSearch;
      const context = { dataStream: writer, writeTopLevelUpdates: false };
      const schema = asSchema(tool.inputSchema);
      const json = await schema.jsonSchema;
      expect(json.required).toEqual(
        expect.arrayContaining([
          "search_queries",
          "topics",
          "searchDepth",
          "exclude_domains",
        ])
      );
      const input = {
        exclude_domains: null,
        searchDepth: null,
        search_queries: [{ query: "defaults", maxResults: null }],
        topics: null,
      };
      expect(await schema.validate?.(input)).toMatchObject({ success: true });
      expect(
        await schema.validate?.({ search_queries: [{ query: "defaults" }] })
      ).toMatchObject({ success: false });
      await tool.execute?.(input, {
        context,
        messages: [],
        toolCallId: "defaults",
      });
    },
  });
  const events: UIMessageChunk[] = [];
  for await (const event of stream) {
    events.push(event);
  }
  expect(events.some((event) => event.type === "error")).toBe(false);
  expect(search).toHaveBeenCalledWith(
    "defaults",
    expect.objectContaining({
      excludeDomains: [],
      maxResults: 5,
      searchDepth: "basic",
      topic: "general",
    })
  );
});

test("search executes without ChatJS progress services", async () => {
  search.mockResolvedValue({
    results: [
      { content: "Evidence", title: "Source", url: "https://example.com" },
    ],
  });
  const result = await webSearch.execute?.(
    {
      exclude_domains: null,
      searchDepth: null,
      search_queries: [{ query: "test", maxResults: null }],
      topics: null,
    },
    { context: {}, messages: [], toolCallId: "standalone" }
  );
  expect(result).toMatchObject({
    searches: [{ results: [{ content: "Evidence" }] }],
  });
});
