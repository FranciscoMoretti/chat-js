import type { FileUIPart, ModelMessage, Tool } from "ai";
import type { ModelId } from "@/lib/ai/app-models";
import { installedTools } from "@/lib/ai/installed-tools";
import { getOrCreateMcpClient, type MCPClient } from "@/lib/ai/mcp/mcp-client";
import { createToolId } from "@/lib/ai/mcp-name-id";
import type { StreamWriter } from "@/lib/ai/types";
import { config } from "@/lib/config";
import type { CostAccumulator } from "@/lib/credits/cost-accumulator";
import type { McpConnector } from "@/lib/db/schema";
import { createModuleLogger } from "@/lib/logger";
import { codeExecution } from "./code-execution";
import { deepResearch } from "./deep-research/deep-research";
import { createCodeDocumentTool } from "./documents/create-code-document";
import { createSheetDocumentTool } from "./documents/create-sheet-document";
import { createTextDocumentTool } from "./documents/create-text-document";
import { editCodeDocumentTool } from "./documents/edit-code-document";
import { editSheetDocumentTool } from "./documents/edit-sheet-document";
import { editTextDocumentTool } from "./documents/edit-text-document";
import { generateImageTool } from "./generate-image";
import { generateVideoTool } from "./generate-video";
import { readDocument } from "./read-document";
import type { ToolSession } from "./types";
import { webSearch } from "./web-search";

const log = createModuleLogger("tools:mcp");

export function getTools({
  dataStream,
  session,
  messageId,
  selectedModel,
  attachments = [],
  lastGeneratedImage = null,
  contextForLLM,
  costAccumulator,
}: {
  dataStream: StreamWriter;
  session: ToolSession;
  messageId: string;
  selectedModel: ModelId;
  attachments: FileUIPart[];
  lastGeneratedImage: { imageUrl: string; name: string } | null;
  contextForLLM: ModelMessage[];
  costAccumulator: CostAccumulator;
}) {
  const documentToolProps = {
    session,
    messageId,
    selectedModel,
    costAccumulator,
  };
  const enabledInstalledTools = Object.fromEntries(
    Object.entries(installedTools).filter(
      ([name]) => name !== "retrieveUrl" || config.ai.tools.urlRetrieval.enabled
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
                  session,
                  dataStream,
                }),
              }
            : {}),
        }
      : {}),
    ...(config.ai.tools.webSearch.enabled
      ? {
          webSearch: webSearch({
            dataStream,
            writeTopLevelUpdates: true,
            costAccumulator,
          }),
        }
      : {}),

    ...(config.ai.tools.codeExecution.enabled
      ? { codeExecution: codeExecution({ costAccumulator }) }
      : {}),
    ...(config.ai.tools.image.enabled
      ? {
          generateImage: generateImageTool({
            attachments,
            lastGeneratedImage,
            selectedModel,
            costAccumulator,
          }),
        }
      : {}),
    ...(config.ai.tools.deepResearch.enabled
      ? {
          deepResearch: deepResearch({
            session,
            dataStream,
            messageId,
            messages: contextForLLM,
            costAccumulator,
          }),
        }
      : {}),
    ...(config.ai.tools.video.enabled
      ? {
          generateVideo: generateVideoTool({ selectedModel, costAccumulator }),
        }
      : {}),
    ...enabledInstalledTools,
  };
}

/**
 * Creates MCP clients for the given connectors and returns their tools.
 * Uses OAuth-aware MCP clients that can authenticate with OAuth 2.1 + PKCE.
 * Returns both the tools and a cleanup function to close all clients.
 */
export async function getMcpTools({
  connectors,
}: {
  connectors: McpConnector[];
}): Promise<{
  tools: Record<string, Tool>;
  cleanup: () => Promise<void>;
}> {
  if (!config.ai.tools.mcp.enabled) {
    return {
      tools: {},
      cleanup: async () => Promise.resolve(),
    };
  }

  const enabledConnectors = connectors.filter((c) => c.enabled);

  if (enabledConnectors.length === 0) {
    return {
      tools: {},
      cleanup: async () => Promise.resolve(),
    };
  }

  const clients: MCPClient[] = [];
  const allTools: Record<string, Tool> = {};

  for (const connector of enabledConnectors) {
    try {
      // Get or create OAuth-aware MCP client
      const mcpClient = getOrCreateMcpClient({
        id: connector.id,
        name: connector.name,
        url: connector.url,
        type: connector.type,
        // Legacy Basic auth headers for connectors that have client credentials
        headers:
          connector.oauthClientId && connector.oauthClientSecret
            ? {
                Authorization: `Basic ${Buffer.from(`${connector.oauthClientId}:${connector.oauthClientSecret}`).toString("base64")}`,
              }
            : undefined,
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

  return { tools: allTools, cleanup };
}
