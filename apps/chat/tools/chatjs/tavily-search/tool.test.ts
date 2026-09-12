import { asSchema, createUIMessageStream, type UIMessageChunk } from "ai";
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
      { title: "Source", url: "https://example.com", content: "Evidence" },
    ],
  });
  const stream = createUIMessageStream<ChatMessage>({
    execute: async ({ writer }) => {
      const tool = webSearch;
      const context = { dataStream: writer, writeTopLevelUpdates: true };
      const result = await tool.execute?.(
        {
          search_queries: [{ query: "news", maxResults: 3 }],
          topics: ["news"],
          searchDepth: "advanced",
          exclude_domains: ["excluded.com"],
        },
        { toolCallId: "call", messages: [], context }
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
        search_queries: [{ query: "defaults", maxResults: null }],
        topics: null,
        searchDepth: null,
        exclude_domains: null,
      };
      expect(await schema.validate?.(input)).toMatchObject({ success: true });
      expect(
        await schema.validate?.({ search_queries: [{ query: "defaults" }] })
      ).toMatchObject({ success: false });
      await tool.execute?.(input, {
        toolCallId: "defaults",
        messages: [],
        context,
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
      maxResults: 5,
      searchDepth: "basic",
      topic: "general",
      excludeDomains: [],
    })
  );
});

test("search executes without ChatJS progress services", async () => {
  search.mockResolvedValue({
    results: [
      { title: "Source", url: "https://example.com", content: "Evidence" },
    ],
  });
  const result = await webSearch.execute?.(
    {
      search_queries: [{ query: "test", maxResults: null }],
      topics: null,
      searchDepth: null,
      exclude_domains: null,
    },
    { toolCallId: "standalone", messages: [], context: {} }
  );
  expect(result).toMatchObject({
    searches: [{ results: [{ content: "Evidence" }] }],
  });
});
