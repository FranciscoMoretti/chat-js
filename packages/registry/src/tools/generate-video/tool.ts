import { experimental_generateVideo as generateVideo } from "ai";
import { defineTool } from "eve/tools";
import type { ToolContext } from "eve/tools";

import { config } from "@/lib/config";
import { eveGeneratedFileUploader } from "@/lib/eve/generated-files";
import { createEveToolCost } from "@/lib/eve/tool-cost";
import { toolResultToModelOutput } from "@/lib/eve/tool-model-output";
import { eveToolModelProvider } from "@/lib/eve/tool-models";
import { executeWithToolUsage } from "@/lib/eve/tool-usage";
import { createModuleLogger } from "@/lib/logger";

import { generateVideoInput } from "./schemas";

// Fixed estimate — not yet available from provider API
const COST_CENTS = 50;

const log = createModuleLogger("ai.tools.generate-video");
const DEFAULT_ASPECT_RATIO = "16:9";
const DEFAULT_DURATION_SECONDS = 5;
const FIRST_SUBTYPE_INDEX = 0;
const FIRST_PARAMETER_INDEX = 0;
const ALLOWED_EXTENSIONS = new Set(["mp4", "webm", "mov"]);

const resolveVideoExtension = (mediaType?: string): string => {
  if (!(typeof mediaType === "string" && mediaType !== "")) {
    return "mp4";
  }

  const [, subtypeWithParams] = mediaType.split("/");
  if (!subtypeWithParams) {
    return "mp4";
  }

  const subtype = subtypeWithParams
    .split(";")
    .at(FIRST_SUBTYPE_INDEX)
    ?.trim()
    .toLowerCase();
  if (!(typeof subtype === "string" && subtype !== "")) {
    return "mp4";
  }

  const mappedSubtype = subtype === "quicktime" ? "mov" : subtype;
  return ALLOWED_EXTENSIONS.has(mappedSubtype) ? mappedSubtype : "mp4";
};

const resolveVideoModel = async (
  modelProvider: Readonly<typeof eveToolModelProvider>,
  selectedModel?: string
): Promise<string> => {
  if (typeof selectedModel === "string" && selectedModel !== "") {
    try {
      const model = await modelProvider.getModelDefinition(selectedModel);
      if (model.output.video) {
        return model.apiModelId;
      }
    } catch {
      // Not in app models registry, fall through
    }
  }
  const modelId = config.ai.tools.video.default;
  if (!(typeof modelId === "string" && modelId !== "")) {
    throw new Error(
      "Set ai.tools.video.default to a video model supported by your gateway."
    );
  }
  return modelId;
};

type Context = Readonly<
  Pick<ToolContext, "session"> & { abortSignal: Readonly<AbortSignal> }
>;
type Usage = Readonly<
  NonNullable<
    Parameters<typeof createEveToolCost>[typeof FIRST_PARAMETER_INDEX]
  >
>;
type GenerationOptions = Readonly<{
  abortSignal: Readonly<AbortSignal>;
  aspectRatio: "16:9" | "9:16" | "1:1";
  durationSeconds: number;
  prompt: string;
  startMs: number;
}>;
type Input = Readonly<{
  prompt: string;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  durationSeconds?: number;
}>;
type Integration = Readonly<{
  costAccumulator: Readonly<ReturnType<typeof createEveToolCost>>;
  uploadFile: ReturnType<typeof eveGeneratedFileUploader>;
  usage: Usage;
}>;
type PreparedGeneration = Readonly<{
  integration: Integration;
  modelProvider: Readonly<typeof eveToolModelProvider>;
  options: GenerationOptions;
  selectedModel?: string;
}>;
const videoRequest = (
  modelId: string,
  options: GenerationOptions,
  isGoogleModel: boolean
): Parameters<typeof generateVideo>[typeof FIRST_PARAMETER_INDEX] => ({
  abortSignal: options.abortSignal,
  aspectRatio: options.aspectRatio,
  duration: options.durationSeconds,
  model: eveToolModelProvider.createVideoModel(modelId),
  prompt: options.prompt,
  providerOptions: {
    ...(isGoogleModel && {
      google: { aspectRatio: options.aspectRatio },
    }),
  },
});
// A completed generation followed by a storage failure is an explicit domain result.
const storeWithDomainFailure = async (
  upload: () => ReturnType<ReturnType<typeof eveGeneratedFileUploader>>,
  usage: Usage
): ReturnType<ReturnType<typeof eveGeneratedFileUploader>> => {
  try {
    return await upload();
  } catch {
    return usage.fail();
  }
};
const storeGeneratedResult = async (
  upload: () => ReturnType<ReturnType<typeof eveGeneratedFileUploader>>,
  summary: Readonly<{ modelId: string; prompt: string; startMs: number }>,
  usage: Usage
): Promise<{ fileId: string; prompt: string; videoUrl: string }> => {
  const uploaded = await storeWithDomainFailure(upload, usage);
  log.info(
    {
      modelId: summary.modelId,
      ms: Date.now() - summary.startMs,
      videoUrl: uploaded.url,
    },
    "generateVideo: success"
  );
  return {
    fileId: uploaded.fileId,
    prompt: summary.prompt,
    videoUrl: uploaded.url,
  };
};
const generateAndStoreVideo = async (
  modelId: string,
  options: GenerationOptions,
  integration: Integration
): Promise<{ fileId: string; prompt: string; videoUrl: string }> => {
  const isGoogleModel =
    modelId.startsWith("google/") || modelId.includes("gemini");
  log.debug({ modelId }, "generateVideo: resolved model");
  const { video } = await generateVideo(
    videoRequest(modelId, options, isGoogleModel)
  );
  const hasVideo = Boolean(video);
  if (!hasVideo) {
    throw new Error("No video generated");
  }
  // Provider usage is billable even if the subsequent storage upload fails.
  integration.costAccumulator?.addAPICost("generateVideo", COST_CENTS);
  const buffer = Buffer.from(video.uint8Array);
  const uploadArguments = [
    `generated-video-${Date.now()}.${resolveVideoExtension(video.mediaType)}`,
    buffer,
    video.mediaType,
  ] as const;
  return await storeGeneratedResult(
    async () => await integration.uploadFile(...uploadArguments),
    { modelId, prompt: options.prompt, startMs: options.startMs },
    integration.usage
  );
};
const prepareGeneration = (
  input: Input,
  context: Context,
  usage: Usage
): PreparedGeneration => {
  const { abortSignal } = context;
  const costAccumulator = createEveToolCost(usage);
  const modelProvider = eveToolModelProvider;
  const uploadFile = eveGeneratedFileUploader(context);
  const selected = context.session.auth.current?.attributes.modelId;
  // oxlint-disable-next-line eslint/no-undefined -- Start/failure logger payloads keep an own selectedModel field, while the optional resolver argument is absent unless the SDK auth attribute is a string.
  const selectedModel = typeof selected === "string" ? selected : undefined;
  const startMs = Date.now();
  return {
    integration: { costAccumulator, uploadFile, usage },
    modelProvider,
    options: {
      abortSignal,
      aspectRatio: input.aspectRatio ?? DEFAULT_ASPECT_RATIO,
      durationSeconds: input.durationSeconds ?? DEFAULT_DURATION_SECONDS,
      prompt: input.prompt,
      startMs,
    },
    selectedModel,
  };
};

const throwVideoFailure = (
  error: unknown,
  startMs: number,
  selectedModel?: string
): never => {
  const errorMessage = error instanceof Error ? error.message : "";
  const isUnsupportedVideoGateway = errorMessage.includes(
    "does not support video models"
  );

  log.error(
    {
      error:
        error instanceof Error
          ? { message: error.message, name: error.name }
          : error,
      ms: Date.now() - startMs,
      selectedModel,
    },
    "generateVideo: failure"
  );

  if (isUnsupportedVideoGateway) {
    throw new Error(
      "Video generation is not available for the active gateway.",
      { cause: error }
    );
  }

  throw error;
};

export const generateVideoTool = defineTool({
  description:
    "Generate a short video clip from a text prompt. Use this when the user asks to create, make, or generate a video.",
  execute: async (
    { prompt, aspectRatio, durationSeconds }: Input,
    context: Context
  ) =>
    await executeWithToolUsage(context, async (usage: Usage) => {
      const prepared = prepareGeneration(
        { aspectRatio, durationSeconds, prompt },
        context,
        usage
      );
      log.info(
        {
          aspectRatio: prepared.options.aspectRatio,
          durationSeconds: prepared.options.durationSeconds,
          promptLength: prompt.length,
          selectedModel: prepared.selectedModel,
        },
        "generateVideo: start"
      );
      try {
        const hasModelProvider = Boolean(prepared.modelProvider);
        if (!hasModelProvider) {
          throw new Error("Video generation requires model provider context.");
        }
        const modelId = await resolveVideoModel(
          prepared.modelProvider,
          prepared.selectedModel
        );
        return await generateAndStoreVideo(
          modelId,
          prepared.options,
          prepared.integration
        );
      } catch (error) {
        return throwVideoFailure(
          error,
          prepared.options.startMs,
          prepared.selectedModel
        );
      }
    }),
  inputSchema: generateVideoInput,
  toModelOutput: toolResultToModelOutput,
});
