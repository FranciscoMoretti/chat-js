import { experimental_generateVideo as generateVideo, tool } from "ai";
import type { ToolExecutionOptions } from "ai";

import type { ChatToolContext, ToolModelProvider } from "@/lib/ai/tool-context";
import { config } from "@/lib/config";
import { uploadFile } from "@/lib/file-storage";
import { createModuleLogger } from "@/lib/logger";

import { generateVideoInput } from "./schemas";

// Fixed estimate — not yet available from provider API
const COST_CENTS = 50;

const log = createModuleLogger("ai.tools.generate-video");
const DEFAULT_ASPECT_RATIO = "16:9";
const DEFAULT_DURATION_SECONDS = 5;
const ALLOWED_EXTENSIONS = new Set(["mp4", "webm", "mov"]);

const resolveVideoExtension = (mediaType?: string): string => {
  if (!mediaType) {
    return "mp4";
  }

  const [, subtypeWithParams] = mediaType.split("/");
  if (!subtypeWithParams) {
    return "mp4";
  }

  const subtype = subtypeWithParams.split(";")[0]?.trim().toLowerCase();
  if (!subtype) {
    return "mp4";
  }

  const mappedSubtype = subtype === "quicktime" ? "mov" : subtype;
  return ALLOWED_EXTENSIONS.has(mappedSubtype) ? mappedSubtype : "mp4";
};

const resolveVideoModel = async (
  modelProvider: ToolModelProvider,
  selectedModel?: string
): Promise<string> => {
  if (selectedModel) {
    try {
      const model = await modelProvider.getModelDefinition(selectedModel);
      if (model.output.video) {
        return model.apiModelId;
      }
    } catch {
      // Not in app models registry, fall through
    }
  }
  if (!config.ai.tools.video.enabled) {
    throw new Error("Video generation is not enabled");
  }
  const modelId = config.ai.tools.video.default;
  if (!modelId) {
    throw new Error(
      "Set ai.tools.video.default to a video model supported by your gateway."
    );
  }
  return modelId;
};

export const generateVideoTool = tool({
  description:
    "Generate a short video clip from a text prompt. Use this when the user asks to create, make, or generate a video.",
  execute: async (
    { prompt, aspectRatio, durationSeconds },
    { abortSignal, context }: ToolExecutionOptions<ChatToolContext>
  ): Promise<{ videoUrl: string; prompt: string }> => {
    const {
      costAccumulator,
      modelProvider,
      selectedModel,
      storeFile = uploadFile,
    } = context ?? {};
    const startMs = Date.now();
    const finalAspectRatio = aspectRatio ?? DEFAULT_ASPECT_RATIO;
    const finalDurationSeconds = durationSeconds ?? DEFAULT_DURATION_SECONDS;

    log.info(
      {
        aspectRatio: finalAspectRatio,
        durationSeconds: finalDurationSeconds,
        promptLength: prompt.length,
        selectedModel,
      },
      "generateVideo: start"
    );

    try {
      if (!modelProvider) {
        throw new Error("Video generation requires model provider context.");
      }
      const modelId = await resolveVideoModel(modelProvider, selectedModel);
      const isGoogleModel =
        modelId.startsWith("google/") || modelId.includes("gemini");

      log.debug({ modelId }, "generateVideo: resolved model");

      const result = await generateVideo({
        abortSignal,
        aspectRatio: finalAspectRatio,
        duration: finalDurationSeconds,
        model: modelProvider.createVideoModel(modelId),
        prompt,
        providerOptions: {
          ...(isGoogleModel && {
            google: {
              aspectRatio: finalAspectRatio,
            },
          }),
        },
      });

      const { video } = result;
      if (!video) {
        throw new Error("No video generated");
      }

      // Provider usage is billable even if the subsequent storage upload fails.
      costAccumulator?.addAPICost("generateVideo", COST_CENTS);

      const buffer = Buffer.from(video.uint8Array);
      const timestamp = Date.now();
      const ext = resolveVideoExtension(video.mediaType);
      const filename = `generated-video-${timestamp}.${ext}`;
      const uploaded = await storeFile(filename, buffer, video.mediaType);

      log.info(
        {
          modelId,
          ms: Date.now() - startMs,
          videoUrl: uploaded.url,
        },
        "generateVideo: success"
      );

      return { prompt, videoUrl: uploaded.url };
    } catch (error) {
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
    }
  },
  inputSchema: generateVideoInput,
});
