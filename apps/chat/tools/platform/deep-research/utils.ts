import { experimental_createMCPClient } from "@ai-sdk/mcp";
import type { ToolSet } from "ai";

import { installedTools } from "@/lib/ai/installed-tools";

import type { DeepResearchRuntimeConfig } from "./configuration";

// Keep the MCP transport alive for the entire research tool loop, including errors
// and cancellation. The callback cannot accidentally outlive its connection.
export const withResearchTools = async <T>(
  config: DeepResearchRuntimeConfig,
  run: (tools: ToolSet) => Promise<T>
): Promise<T> => {
  const tools: ToolSet = {};
  if (config.search_enabled && installedTools.webSearch) {
    tools.webSearch = installedTools.webSearch;
  }

  if (!config.mcp_config?.url) {
    return run(tools);
  }

  const client = await experimental_createMCPClient({
    transport: {
      headers: config.mcp_config.headers,
      type: "sse",
      url: config.mcp_config.url,
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
};

// Misc Utils
export const getTodayStr = (): string =>
  new Date().toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    weekday: "short",
    year: "numeric",
  });
