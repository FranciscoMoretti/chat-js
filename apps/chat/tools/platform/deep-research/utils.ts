import { experimental_createMCPClient } from "@ai-sdk/mcp";
import type { ToolSet } from "ai";
import type { ModelId } from "@/lib/ai/app-models";
import { getAppModelDefinition } from "@/lib/ai/app-models";
import type { StreamWriter } from "@/lib/ai/types";
import { firecrawlWebSearch, tavilyWebSearch } from "../web-search";
import type { DeepResearchRuntimeConfig } from "./configuration";

// Keep the MCP transport alive for the entire research tool loop, including errors
// and cancellation. The callback cannot accidentally outlive its connection.
export async function withResearchTools<T>(
  config: DeepResearchRuntimeConfig,
  dataStream: Pick<StreamWriter, "write">,
  run: (tools: ToolSet) => Promise<T>,
  parentToolCallId?: string,
  costAccumulator?: { addAPICost(name: string, cost: number): void }
): Promise<T> {
  const tools: ToolSet = {};
  const searchOptions = {
    dataStream,
    writeTopLevelUpdates: false,
    toolCallIdOverride: parentToolCallId,
    costAccumulator,
  };
  if (config.search_api === "tavily") {
    tools.webSearch = tavilyWebSearch(searchOptions);
  } else if (config.search_api === "firecrawl") {
    tools.webSearch = firecrawlWebSearch(searchOptions);
  }

  if (!config.mcp_config?.url) {
    return run(tools);
  }

  const client = await experimental_createMCPClient({
    transport: {
      type: "sse",
      url: config.mcp_config.url,
      headers: config.mcp_config.headers,
    },
  });
  try {
    const remoteTools = await client.tools();
    for (const [name, remoteTool] of Object.entries(remoteTools)) {
      const allowed =
        !config.mcp_config.tools?.length ||
        config.mcp_config.tools.includes(name);
      if (allowed && !Object.hasOwn(tools, name)) {
        tools[name] = remoteTool;
      }
    }
    return await run(tools);
  } finally {
    await client.close();
  }
}

export async function getModelContextWindow(modelId: ModelId): Promise<number> {
  const model = await getAppModelDefinition(modelId);
  return model.context_window;
}

// Misc Utils
export function getTodayStr(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
