import { beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";

import type { DeepResearchRuntimeConfig } from "./configuration";
import { withResearchTools } from "./utils";

const mocks = vi.hoisted(() => ({
  close: vi.fn(),
  create: vi.fn(),
  search: vi.fn(),
  searchTool: { execute: vi.fn() },
  tools: vi.fn(),
}));
vi.mock("@ai-sdk/mcp", () => ({ experimental_createMCPClient: mocks.create }));
vi.mock("@/lib/ai/installed-tools", () => ({
  installedTools: { webSearch: mocks.searchTool },
}));

const config: DeepResearchRuntimeConfig = {
  allow_clarification: false,
  compression_model: "test",
  compression_model_max_tokens: 100,
  final_report_model: "test",
  final_report_model_max_tokens: 100,
  max_concurrent_research_units: 1,
  max_researcher_iterations: 1,
  max_structured_output_retries: 1,
  mcp_config: {
    headers: { Authorization: "test" },
    url: "https://mcp.test/sse",
  },
  research_model: "test",
  research_model_max_tokens: 100,
  search_api_max_queries: 1,
  search_enabled: true,
  status_update_model: "test",
  status_update_model_max_tokens: 100,
  summarization_model: "test",
  summarization_model_max_tokens: 100,
};
const remote = { execute: vi.fn(), inputSchema: z.object({}) };

beforeEach(() => {
  vi.clearAllMocks();
  // eslint-disable-next-line unicorn/no-useless-undefined -- the mock resolves a void-returning API.
  mocks.close.mockResolvedValue(undefined);
  mocks.create.mockResolvedValue({ close: mocks.close, tools: mocks.tools });
  mocks.tools.mockResolvedValue({ remote });
  mocks.search.mockReturnValue(remote);
});

it("keeps the authenticated MCP client open through execution and closes afterward", async () => {
  const result = await withResearchTools(config, async (tools) => {
    expect(mocks.close).not.toHaveBeenCalled();
    expect(tools.remote).toBe(remote);
    await remote.execute();
    return "report";
  });
  expect(result).toBe("report");
  expect(mocks.close).toHaveBeenCalledOnce();
  expect(mocks.create).toHaveBeenCalledWith({
    transport: {
      headers: { Authorization: "test" },
      type: "sse",
      url: config.mcp_config?.url,
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
      withResearchTools(config, () => Promise.reject(failure))
    ).rejects.toBe(failure);
    expect(mocks.close).toHaveBeenCalledOnce();
  }
);

it("preserves the installed search tool over a remote name", async () => {
  mocks.tools.mockResolvedValue({
    excluded: remote,
    remote,
    webSearch: { inputSchema: z.object({}) },
  });
  await withResearchTools(
    {
      ...config,
      mcp_config: { ...config.mcp_config, tools: ["webSearch", "remote"] },
    },
    async (tools) => {
      expect(Object.keys(tools)).toEqual(["webSearch", "remote"]);
      expect(tools.webSearch).toBe(mocks.searchTool);
      await remote.execute();
    }
  );
});

it("omits installed search when the research configuration disables it", async () => {
  await withResearchTools(
    { ...config, mcp_config: {}, search_enabled: false },
    (tools) => {
      expect(tools).toEqual({});
      return Promise.resolve();
    }
  );
});

it("closes the MCP client when research is cancelled", async () => {
  const cancellation = new AbortController();
  await expect(
    withResearchTools(config, async () => {
      await Promise.resolve();
      cancellation.abort();
      cancellation.signal.throwIfAborted();
    })
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(mocks.close).toHaveBeenCalledOnce();
});
