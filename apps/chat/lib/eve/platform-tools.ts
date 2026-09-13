import type { ModelMessage, ToolSet } from "ai";
import type { ToolContext } from "eve/tools";

import { getActiveGateway } from "../ai/active-gateway";
import type { AppModelId } from "../ai/app-model-id";
import type { InstalledGateway } from "../ai/gateways/registry";
import { installedTools } from "../ai/installed-tools";
import type { ToolModelProvider } from "../ai/tool-context";
import { config } from "../config";
import { executeEveTool } from "./adapt-tool";
import { eveCodeSandboxOwnership } from "./code-sandbox-ownership";
import { eveGeneratedFileUploader } from "./generated-files";
import { eveImageContext } from "./image-context";
import { loadEveModelDefinition } from "./model-selection";
import { executeEvePlatformOperation } from "./platform-operation";
import { isEvePlatformTool } from "./platform-result";

const eveToolModelProvider: ToolModelProvider = {
  createImageModel: (modelId) => {
    const gateway = getActiveGateway();
    const model = gateway.createImageModel(
      modelId as Parameters<InstalledGateway["createImageModel"]>[0]
    );
    if (!model) {
      throw new Error(
        `Gateway '${gateway.type}' does not support dedicated image models. Use a multimodal language model instead.`
      );
    }
    return model;
  },
  createLanguageModel: (modelId) =>
    getActiveGateway().createLanguageModel(
      modelId as Parameters<InstalledGateway["createLanguageModel"]>[0]
    ),
  createVideoModel: (modelId) => {
    const gateway = getActiveGateway();
    const model = gateway.createVideoModel(
      modelId as Parameters<InstalledGateway["createVideoModel"]>[0]
    );
    if (!model) {
      throw new Error(
        `Gateway '${gateway.type}' does not support video models.`
      );
    }
    return model;
  },
  getModelDefinition: async (modelId) => {
    const model = await loadEveModelDefinition(modelId);
    return {
      apiModelId: model.apiModelId,
      // The EVE catalog and active gateway validate the runtime ID at this boundary.
      id: model.id as AppModelId,
      output: model.output,
    };
  },
};

const eveInstalledToolEnabled = (name: string) =>
  (name !== "generateVideo" || config.ai.tools.video.enabled) &&
  (name !== "generateImage" || config.ai.tools.image.enabled) &&
  (name !== "webSearch" || config.ai.tools.webSearch.enabled) &&
  (name !== "codeExecution" || config.ai.tools.codeExecution.enabled);

export const getEvePlatformTools = (): ToolSet =>
  Object.fromEntries(
    Object.entries(installedTools).filter(
      ([name]) => isEvePlatformTool(name) && eveInstalledToolEnabled(name)
    )
  );

/**
 * Persist progress with the native tool call, avoiding a second transcript store.
 * @yields {unknown} Native EVE platform result snapshots.
 */
export const executeEvePlatformTool = async function* executeEvePlatformTool(
  name: string,
  input: unknown,
  context: Pick<ToolContext, "callId" | "abortSignal"> & {
    session?: {
      id: string;
      auth: { initiator?: { principalId: string } | null };
    };
  },
  messages: readonly ModelMessage[],
  selectedModel?: string
) {
  yield* executeEvePlatformOperation(context.abortSignal, (options) => {
    const tools = getEvePlatformTools();
    if (!Object.hasOwn(tools, name)) {
      throw new Error(`Platform tool is unavailable: ${name}`);
    }
    return executeEveTool(
      tools[name],
      input,
      { ...context, abortSignal: options.abortSignal },
      messages,
      {
        ...eveImageContext(messages),
        costAccumulator: options.costAccumulator,
        dataStream: options.dataStream,
        modelProvider: eveToolModelProvider,
        sandboxOwnership:
          name === "codeExecution"
            ? eveCodeSandboxOwnership(context)
            : undefined,
        selectedModel,
        storeFile: eveGeneratedFileUploader({
          ...context,
          abortSignal: options.abortSignal,
        }),
        toolCallIdOverride: context.callId,
        writeTopLevelUpdates: true,
      }
    );
  });
};
