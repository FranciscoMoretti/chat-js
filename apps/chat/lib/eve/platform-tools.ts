import type { ModelMessage, ToolSet } from "ai";
import type { ToolContext } from "eve/tools";
import { codeExecution } from "../../tools/platform/code-execution";
import { generateImageTool } from "../../tools/platform/generate-image";
import { generateVideoTool } from "../../tools/platform/generate-video";
import { tavilyWebSearch } from "../../tools/platform/web-search";
import type { StreamWriter } from "../ai/types";
import { config } from "../config";
import type { uploadFile } from "../file-storage";
import { executeEveTool } from "./adapt-tool";
import { eveGeneratedFileUploader } from "./generated-files";
import { eveImageContext } from "./image-context";
import { executeEvePlatformOperation } from "./platform-operation";
import type { createEveToolCost } from "./tool-cost";

export function getEvePlatformTools({
  dataStream,
  costAccumulator,
  selectedModel,
  messages = [],
  storeFile,
}: {
  dataStream: Pick<StreamWriter, "write">;
  costAccumulator?: Pick<
    ReturnType<typeof createEveToolCost>,
    "addAPICost" | "addLLMCost"
  >;
  storeFile?: typeof uploadFile;
  selectedModel?: string;
  messages?: readonly ModelMessage[];
}): ToolSet {
  return {
    ...(config.ai.tools.image.enabled
      ? {
          generateImage: generateImageTool({
            ...eveImageContext(messages),
            selectedModel,
            costAccumulator,
            storeFile,
          }),
        }
      : {}),
    ...(config.ai.tools.video.enabled
      ? {
          generateVideo: generateVideoTool({
            costAccumulator,
            selectedModel,
            storeFile,
          }),
        }
      : {}),
    ...(config.ai.tools.codeExecution.enabled
      ? { codeExecution: codeExecution({ costAccumulator }) }
      : {}),
    ...(config.ai.tools.webSearch.enabled
      ? {
          webSearch: tavilyWebSearch({
            dataStream,
            costAccumulator,
            writeTopLevelUpdates: true,
          }),
        }
      : {}),
  };
}

/** Persist progress with the native tool call, avoiding a second transcript store. */
export async function* executeEvePlatformTool(
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
    const tools = getEvePlatformTools({
      ...options,
      selectedModel,
      messages,
      storeFile: eveGeneratedFileUploader({
        ...context,
        abortSignal: options.abortSignal,
      }),
    });
    if (!Object.hasOwn(tools, name)) {
      throw new Error(`Platform tool is unavailable: ${name}`);
    }
    return executeEveTool(
      tools[name],
      input,
      { ...context, abortSignal: options.abortSignal },
      messages
    );
  });
}
