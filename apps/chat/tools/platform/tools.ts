import type { FilePart, FileUIPart, ModelMessage, Tool } from "ai";
import {
  type AppModelDefinition,
  type AppModelId,
  getAppModelDefinition,
} from "@/lib/ai/app-models";
import { getOrCreateMcpClient, type MCPClient } from "@/lib/ai/mcp/mcp-client";
import { createToolId } from "@/lib/ai/mcp-name-id";
import {
  getImageModel,
  getLanguageModel,
  getMultimodalImageModel,
  getVideoModel,
} from "@/lib/ai/providers";
import type { StreamWriter } from "@/lib/ai/types";
import { config } from "@/lib/config";
import type { CostAccumulator } from "@/lib/credits/cost-accumulator";
import type { McpConnector } from "@/lib/db/schema";
import { uploadFile } from "@/lib/file-storage";
import { createModuleLogger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/url";
import type {
  ToolNeed,
  ToolRuntimeContext,
} from "@/tools/chatjs/_shared/lib/runtime";
import { createTools as createInstalledTools } from "@/tools/chatjs/tools";
import { codeExecution } from "./code-execution";
import { deepResearch } from "./deep-research/deep-research";
import { createCodeDocumentTool } from "./documents/create-code-document";
import { createSheetDocumentTool } from "./documents/create-sheet-document";
import { createTextDocumentTool } from "./documents/create-text-document";
import { editCodeDocumentTool } from "./documents/edit-code-document";
import { editSheetDocumentTool } from "./documents/edit-sheet-document";
import { editTextDocumentTool } from "./documents/edit-text-document";
import { readDocument } from "./read-document";
import type { ToolSession } from "./types";
import { tavilyWebSearch } from "./web-search";

const log = createModuleLogger("tools:mcp");

function createCapabilities(): ReadonlySet<ToolNeed> {
  const capabilities = new Set<ToolNeed>([
    "env.read",
    "files.attachments",
    "files.previous",
  ]);

  capabilities.add("models.language");
  capabilities.add("media.write");
  if (config.ai.tools.image.enabled) {
    capabilities.add("models.image");
  }
  if (config.ai.tools.video.enabled) {
    capabilities.add("models.video");
  }
  if (config.ai.tools.urlRetrieval.enabled) {
    capabilities.add("url.retrieve");
  }

  return capabilities;
}

function fileUiPartToFilePart(part: FileUIPart): FilePart {
  return {
    data: new URL(part.url, getBaseUrl()),
    filename: part.filename,
    mediaType: part.mediaType,
    type: "file",
  };
}

function createToolRuntimeContext({
  attachments,
  costAccumulator,
  lastGeneratedImage,
}: {
  attachments: FileUIPart[];
  costAccumulator: CostAccumulator;
  lastGeneratedImage: {
    imageUrl: string;
    mediaType: string;
    name: string;
  } | null;
}): ToolRuntimeContext {
  return {
    capabilities: createCapabilities(),
    env: {
      get: (name) => process.env[name],
      require: (name) => {
        const value = process.env[name];
        if (!value) {
          throw new Error(`Missing required env var: ${name}`);
        }
        return value;
      },
    },
    files: {
      attachments: async ({ mediaTypes } = {}) =>
        attachments
          .filter((part) => {
            if (!mediaTypes?.length) {
              return true;
            }
            return mediaTypes.some((mediaType) =>
              part.mediaType.startsWith(mediaType)
            );
          })
          .map(fileUiPartToFilePart),
      previous: ({ kind, limit } = {}) => {
        if (kind && kind !== "image") {
          return Promise.resolve([]);
        }
        if (!lastGeneratedImage) {
          return Promise.resolve([]);
        }
        const file: FilePart = {
          data: new URL(lastGeneratedImage.imageUrl, getBaseUrl()),
          filename: lastGeneratedImage.name,
          mediaType: lastGeneratedImage.mediaType,
          type: "file",
        };
        return Promise.resolve([file].slice(0, limit));
      },
    },
    media: {
      write: async ({ bytes, filename, mediaType }) => {
        const finalFilename =
          filename ?? `generated-media-${crypto.randomUUID()}`;
        const uploaded = await uploadFile(
          finalFilename,
          Buffer.from(bytes),
          mediaType
        );
        return {
          filename: finalFilename,
          mediaType,
          size: bytes.byteLength,
          url: uploaded.url,
        };
      },
    },
    models: {
      image: ({ model } = {}) =>
        Promise.resolve().then(() => {
          if (!config.ai.tools.image.enabled) {
            throw new Error("Image generation is not enabled");
          }
          return getImageModel(model ?? config.ai.tools.image.default);
        }),
      imageGeneration: async ({ model } = {}) => {
        if (!config.ai.tools.image.enabled) {
          throw new Error("Image generation is not enabled");
        }

        const modelId = model ?? config.ai.tools.image.default;
        let modelDefinition: AppModelDefinition | null = null;
        try {
          modelDefinition = await getAppModelDefinition(modelId as AppModelId);
        } catch (error) {
          if (
            !(error instanceof Error) ||
            error.message !== `Model ${modelId} not found`
          ) {
            throw error;
          }
        }
        if (modelDefinition?.output.image) {
          return {
            model: getMultimodalImageModel(modelId),
            modelId,
            type: "language" as const,
          };
        }

        return {
          model: getImageModel(modelId),
          modelId,
          type: "image" as const,
        };
      },
      language: async ({ model } = {}) =>
        getLanguageModel((model ?? config.ai.workflows.chat) as AppModelId),
      video: ({ model } = {}) =>
        Promise.resolve().then(() => {
          if (!config.ai.tools.video.enabled) {
            throw new Error("Video generation is not enabled");
          }
          return getVideoModel(model ?? config.ai.tools.video.default);
        }),
    },
    cost: {
      addAPICost: (apiName, cost) => {
        costAccumulator.addAPICost(apiName, cost);
      },
      addLLMCost: (modelId, usage, source) => {
        costAccumulator.addLLMCost(modelId as AppModelId, usage, source);
      },
    },
  };
}

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
  selectedModel: AppModelId;
  attachments: FileUIPart[];
  lastGeneratedImage: {
    imageUrl: string;
    mediaType: string;
    name: string;
  } | null;
  contextForLLM: ModelMessage[];
  costAccumulator: CostAccumulator;
}) {
  const documentToolProps = {
    session,
    messageId,
    selectedModel,
    costAccumulator,
  };
  const installedRuntimeContext = createToolRuntimeContext({
    attachments,
    costAccumulator,
    lastGeneratedImage,
  });
  const installedTools = createInstalledTools(installedRuntimeContext);
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
          webSearch: tavilyWebSearch({
            dataStream,
            writeTopLevelUpdates: true,
            costAccumulator,
          }),
        }
      : {}),

    ...(config.ai.tools.codeExecution.enabled
      ? { codeExecution: codeExecution({ costAccumulator }) }
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
    ...installedTools,
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
