import type { ModelMessage, Tool } from "ai";

import type { ModelId } from "@/lib/ai/app-models";
import { installedTools } from "@/lib/ai/installed-tools";
import { createToolId } from "@/lib/ai/mcp-name-id";
import { getOrCreateMcpClient } from "@/lib/ai/mcp/mcp-client";
import type { MCPClient } from "@/lib/ai/mcp/mcp-client";
import type { StreamWriter } from "@/lib/ai/types";
import { config } from "@/lib/config";
import type { CostAccumulator } from "@/lib/credits/cost-accumulator";
import type { McpConnector } from "@/lib/db/schema";
import { createModuleLogger } from "@/lib/logger";

import { deepResearch } from "./deep-research/deep-research";
import { createCodeDocumentTool } from "./documents/create-code-document";
import { createSheetDocumentTool } from "./documents/create-sheet-document";
import { createTextDocumentTool } from "./documents/create-text-document";
import { editCodeDocumentTool } from "./documents/edit-code-document";
import { editSheetDocumentTool } from "./documents/edit-sheet-document";
import { editTextDocumentTool } from "./documents/edit-text-document";
import { readDocument } from "./read-document";
import type { ToolSession } from "./types";

const log = createModuleLogger("tools:mcp");

export const getTools = ({
  dataStream,
  session,
  messageId,
  selectedModel,
  contextForLLM,
  costAccumulator,
}: {
  dataStream: StreamWriter;
  session: ToolSession;
  messageId: string;
  selectedModel: ModelId;
  contextForLLM: ModelMessage[];
  costAccumulator: CostAccumulator;
}) => {
  const documentToolProps = {
    costAccumulator,
    messageId,
    selectedModel,
    session,
  };
  const enabledInstalledTools = Object.fromEntries(
    Object.entries(installedTools).filter(
      ([name]) =>
        (name !== "generateVideo" || config.ai.tools.video.enabled) &&
        (name !== "generateImage" || config.ai.tools.image.enabled) &&
        (name !== "retrieveUrl" || config.ai.tools.urlRetrieval.enabled) &&
        (name !== "webSearch" || config.ai.tools.webSearch.enabled) &&
        (name !== "codeExecution" || config.ai.tools.codeExecution.enabled)
    )
  );
  const documentTypes = config.ai.tools.documents.types;
  const documentsEnabled = config.ai.tools.documents.enabled;
  const hasEnabledDocumentType =
    documentTypes.text || documentTypes.code || documentTypes.sheet;

  return {
    ...(documentsEnabled
      ? {
          ...(documentTypes.text
            ? {
                createTextDocument: createTextDocumentTool(documentToolProps),
                editTextDocument: editTextDocumentTool(documentToolProps),
              }
            : {}),
          ...(documentTypes.code
            ? {
                createCodeDocument: createCodeDocumentTool(documentToolProps),
                editCodeDocument: editCodeDocumentTool(documentToolProps),
              }
            : {}),
          ...(documentTypes.sheet
            ? {
                createSheetDocument: createSheetDocumentTool(documentToolProps),
                editSheetDocument: editSheetDocumentTool(documentToolProps),
              }
            : {}),
          ...(hasEnabledDocumentType
            ? {
                readDocument: readDocument({
                  dataStream,
                  session,
                }),
              }
            : {}),
        }
      : {}),
    ...(config.ai.tools.deepResearch.enabled
      ? {
          deepResearch: deepResearch({
            costAccumulator,
            dataStream,
            messageId,
            messages: contextForLLM,
            session,
          }),
        }
      : {}),
    ...enabledInstalledTools,
  };
};

/**
 * Creates MCP clients for the given connectors and returns their tools.
 * Uses OAuth-aware MCP clients that can authenticate with OAuth 2.1 + PKCE.
 * Returns both the tools and a cleanup function to close all clients.
 */
export const getMcpTools = async ({
  connectors,
}: {
  connectors: McpConnector[];
}): Promise<{
  tools: Record<string, Tool>;
  cleanup: () => Promise<void>;
}> => {
  if (!config.ai.tools.mcp.enabled) {
    return {
      cleanup: () => Promise.resolve(),
      tools: {},
    };
  }

  const enabledConnectors = connectors.filter((c) => c.enabled);

  if (enabledConnectors.length === 0) {
    return {
      cleanup: () => Promise.resolve(),
      tools: {},
    };
  }

  const clients: MCPClient[] = [];
  const allTools: Record<string, Tool> = {};

  for (const connector of enabledConnectors) {
    try {
      // Get or create OAuth-aware MCP client
      const mcpClient = getOrCreateMcpClient({
        // Legacy Basic auth headers for connectors that have client credentials
        headers:
          connector.oauthClientId && connector.oauthClientSecret
            ? {
                Authorization: `Basic ${Buffer.from(`${connector.oauthClientId}:${connector.oauthClientSecret}`).toString("base64")}`,
              }
            : undefined,
        id: connector.id,
        name: connector.name,
        type: connector.type,
        url: connector.url,
      });

      // Attempt to connect
      await mcpClient.connect();

      // Skip connectors that need OAuth authorization
      if (mcpClient.status === "authorizing") {
        log.info(
          { connector: connector.name },
          "MCP connector needs OAuth authorization, skipping"
        );
        continue;
      }

      // Skip if not connected
      if (mcpClient.status !== "connected") {
        log.warn(
          { connector: connector.name, status: mcpClient.status },
          "MCP connector not connected, skipping"
        );
        continue;
      }

      clients.push(mcpClient);
      const tools = await mcpClient.tools();

      // Namespace tool names with connector nameId to avoid collisions
      // Format: {namespace}.{toolName} or global.{namespace}.{toolName}
      const isGlobal = connector.userId === null;
      for (const [toolName, tool] of Object.entries(tools)) {
        const toolId = createToolId(connector.nameId, toolName, isGlobal);
        allTools[toolId] = tool as Tool;
      }

      log.info(
        { connector: connector.name, toolCount: Object.keys(tools).length },
        "MCP client connected"
      );
    } catch (error) {
      log.error(
        { connector: connector.name, error },
        "Failed to connect to MCP server"
      );
      // Continue with other connectors even if one fails
    }
  }

  const cleanup = async () => {
    await Promise.all(
      clients.map(async (client) => {
        try {
          await client.close();
        } catch (error) {
          log.error({ error }, "Failed to close MCP client");
        }
      })
    );
  };

  return { cleanup, tools: allTools };
};
