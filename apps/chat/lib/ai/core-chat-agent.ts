import { convertToModelMessages, isStepCount, streamText } from "ai";
import { addExplicitToolRequestToMessages } from "@/app/(chat)/api/chat/add-explicit-tool-request-to-messages";
import { filterPartsForLLM } from "@/app/(chat)/api/chat/filter-reasoning-parts";
import { getRecentGeneratedImage } from "@/app/(chat)/api/chat/get-recent-generated-image";
import { type AppModelId, getAppModelDefinition } from "@/lib/ai/app-models";
import { markdownJoinerTransform } from "@/lib/ai/markdown-joiner-transform";
import { getLanguageModel, getModelProviderOptions } from "@/lib/ai/providers";
import { chatTelemetry } from "@/lib/ai/telemetry";
import type { ChatMessage, StreamWriter, ToolName } from "@/lib/ai/types";
import type { CostAccumulator } from "@/lib/credits/cost-accumulator";
import type { McpConnector } from "@/lib/db/schema";
import { ANONYMOUS_LIMITS } from "@/lib/types/anonymous";
import { replaceFilePartUrlByBinaryDataInMessages } from "@/lib/utils/download-assets";
import { getMcpTools, getTools } from "@/tools/platform/tools";

export async function createCoreChatAgent({
  system,
  userMessage,
  previousMessages,
  selectedModelId,
  explicitlyRequestedTools,
  userId,
  isAnonymous = false,
  abortSignal,
  messageId,
  dataStream,
  onError,
  onChunk,
  mcpConnectors = [],
  costAccumulator,
}: {
  system: string;
  userMessage: ChatMessage;
  previousMessages: ChatMessage[];
  selectedModelId: AppModelId;
  explicitlyRequestedTools: ToolName[] | null;
  userId: string | null;
  isAnonymous?: boolean;
  abortSignal?: AbortSignal;
  messageId: string;
  dataStream: StreamWriter;
  onError?: (error: unknown) => void;
  onChunk?: () => void;
  mcpConnectors?: McpConnector[];
  costAccumulator: CostAccumulator;
}) {
  const modelDefinition = await getAppModelDefinition(selectedModelId);

  // Build message thread
  const messages = [...previousMessages, userMessage].slice(-5);

  // Process conversation history
  const lastGeneratedImage = getRecentGeneratedImage(messages);

  addExplicitToolRequestToMessages(messages, explicitlyRequestedTools);

  // Filter reasoning parts (cross-model compatibility)
  const filteredMessages = filterPartsForLLM(messages.slice(-5));

  // Convert to model messages, ignoring data-* parts (drop them)
  const modelMessages = await convertToModelMessages(filteredMessages, {
    convertDataPart: (_part): undefined => undefined,
  });

  // Replace file URLs with binary data
  const contextForLLM =
    await replaceFilePartUrlByBinaryDataInMessages(modelMessages);

  // Get MCP tools if connectors are configured
  const { tools: mcpTools, cleanup: mcpCleanup } = await getMcpTools({
    connectors: mcpConnectors,
  });

  // Get base tools
  const baseTools = getTools({
    dataStream,
    session: {
      user: userId ? { id: userId } : undefined,
    },
    contextForLLM,
    messageId,
    selectedModel: modelDefinition.apiModelId,
    attachments: userMessage.parts.filter((part) => part.type === "file"),
    lastGeneratedImage,
    costAccumulator,
  });

  // Merge base tools with MCP tools
  const allTools = {
    ...baseTools,
    ...mcpTools,
  };

  // Compute final activeTools for streamText
  let activeBaseTools = Object.keys(baseTools) as ToolName[];
  let activeMcpTools = Object.keys(mcpTools) as ToolName[];
  if (!modelDefinition?.input) {
    activeBaseTools = [];
    activeMcpTools = [];
  } else if (isAnonymous) {
    activeBaseTools = activeBaseTools.filter((k) =>
      (ANONYMOUS_LIMITS.AVAILABLE_TOOLS as ToolName[]).includes(k)
    );
    activeMcpTools = [];
  }
  if (explicitlyRequestedTools !== null) {
    activeBaseTools = explicitlyRequestedTools.filter((k) =>
      activeBaseTools.includes(k)
    );
    activeMcpTools = explicitlyRequestedTools.filter((k) =>
      activeMcpTools.includes(k)
    );
  }
  const activeTools = [
    ...new Set([...activeBaseTools, ...activeMcpTools]),
  ] as (keyof typeof allTools)[];

  // Resolve async model config before streamText to ensure cleanup on failure
  let model: Awaited<ReturnType<typeof getLanguageModel>>;
  let providerOptions: Awaited<ReturnType<typeof getModelProviderOptions>>;
  try {
    [model, providerOptions] = await Promise.all([
      getLanguageModel(selectedModelId),
      getModelProviderOptions(selectedModelId),
    ]);
  } catch (error) {
    await mcpCleanup();
    throw error;
  }

  const result = streamText({
    model,
    instructions: system,
    messages: contextForLLM,
    stopWhen: [
      isStepCount(5),
      ({ steps }) => {
        return steps.some((step) => {
          const toolResults = step.content;
          // Don't stop if the tool result is a clarifying question
          return toolResults.some(
            (toolResult) =>
              toolResult.type === "tool-result" &&
              toolResult.toolName === "deepResearch" &&
              (toolResult.output as { format?: string }).format === "report"
          );
        });
      },
    ],
    activeTools,
    experimental_transform: markdownJoinerTransform(),
    telemetry: {
      integrations: chatTelemetry,
      isEnabled: true,
      functionId: "chat-response",
    },
    tools: allTools,
    onError: (error) => {
      onError?.(error);
    },
    onChunk,
    abortSignal,
    providerOptions,
    onEnd: async () => {
      // Release MCP clients after generation completes.
      await mcpCleanup();
    },
  });

  return {
    result,
    contextForLLM,
    modelDefinition,
    mcpCleanup,
  };
}
