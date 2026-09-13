import { beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";

const mocks = vi.hoisted(() => ({
  close: vi.fn(),
  tools: vi.fn(),
  create: vi.fn(),
  search: vi.fn(),
}));
vi.mock("@ai-sdk/mcp", () => ({ experimental_createMCPClient: mocks.create }));
vi.mock("@/lib/ai/app-models", () => ({ getAppModelDefinition: vi.fn() }));
vi.mock("../web-search", () => ({
  tavilyWebSearch: mocks.search,
  firecrawlWebSearch: mocks.search,
}));

import type { DeepResearchRuntimeConfig } from "./configuration";
import { withResearchTools } from "./utils";

const config: DeepResearchRuntimeConfig = {
  allow_clarification: false,
  compression_model: "test",
  compression_model_max_tokens: 100,
  final_report_model: "test",
  final_report_model_max_tokens: 100,
  max_concurrent_research_units: 1,
  max_researcher_iterations: 1,
  max_structured_output_retries: 1,
  research_model: "test",
  research_model_max_tokens: 100,
  search_api: "none",
  search_api_max_queries: 1,
  status_update_model: "test",
  status_update_model_max_tokens: 100,
  summarization_model: "test",
  summarization_model_max_tokens: 100,
  mcp_config: {
    url: "https://mcp.test/sse",
    headers: { Authorization: "test" },
  },
};
const remote = { inputSchema: z.object({}), execute: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.close.mockResolvedValue(undefined);
  mocks.create.mockResolvedValue({ tools: mocks.tools, close: mocks.close });
  mocks.tools.mockResolvedValue({ remote });
  mocks.search.mockReturnValue(remote);
});

it("keeps the authenticated MCP client open through execution and closes afterward", async () => {
  const result = await withResearchTools(
    config,
    { write: vi.fn() },
    async (tools) => {
      expect(mocks.close).not.toHaveBeenCalled();
      expect(tools.remote).toBe(remote);
      await remote.execute();
      return "report";
    }
  );
  expect(result).toBe("report");
  expect(mocks.close).toHaveBeenCalledOnce();
  expect(mocks.create).toHaveBeenCalledWith({
    transport: {
      type: "sse",
      url: config.mcp_config?.url,
      headers: { Authorization: "test" },
    },
  });
});

it.each(["discovery", "execution"])(
  "closes the client when %s fails",
  async (phase) => {
    const failure = new Error("failed");
    if (phase === "discovery") {
      mocks.tools.mockRejectedValueOnce(failure);
    }
    await expect(
      withResearchTools(config, { write: vi.fn() }, () =>
        Promise.reject(failure)
      )
    ).rejects.toBe(failure);
    expect(mocks.close).toHaveBeenCalledOnce();
  }
);

it.each(["tavily", "firecrawl"] as const)(
  "forwards %s usage and preserves built-in tools over remote names",
  async (search_api) => {
    const costAccumulator = { addAPICost: vi.fn() };
    mocks.tools.mockResolvedValue({
      webSearch: { inputSchema: z.object({}) },
      remote,
      excluded: remote,
    });
    await withResearchTools(
      {
        ...config,
        search_api,
        mcp_config: { ...config.mcp_config, tools: ["webSearch", "remote"] },
      },
      { write: vi.fn() },
      async (tools) => {
        expect(Object.keys(tools)).toEqual(["webSearch", "remote"]);
        expect(tools.webSearch).toBe(remote);
        await remote.execute();
      },
      "parent",
      costAccumulator
    );
    expect(mocks.search).toHaveBeenCalledWith(
      expect.objectContaining({
        costAccumulator,
        toolCallIdOverride: "parent",
        writeTopLevelUpdates: false,
      })
    );
  }
);

it("closes the MCP client when research is cancelled", async () => {
  const cancellation = new AbortController();
  await expect(
    withResearchTools(config, { write: vi.fn() }, async () => {
      await Promise.resolve();
      cancellation.abort();
      cancellation.signal.throwIfAborted();
    })
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(mocks.close).toHaveBeenCalledOnce();
});
