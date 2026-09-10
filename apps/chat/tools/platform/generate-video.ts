import { experimental_generateVideo as generateVideo, tool } from "ai";
import { getActiveGateway } from "@/lib/ai/active-gateway";
import { toModelData } from "@/lib/ai/to-model-data";
import { config } from "@/lib/config";
import type { CostAccumulator } from "@/lib/credits/cost-accumulator";
import { uploadFile } from "@/lib/file-storage";
import { createModuleLogger } from "@/lib/logger";
import { generateVideoInput } from "./generate-video.schemas";

const COST_CENTS = 50; // Fixed estimate — not yet available from provider API

interface GenerateVideoProps {
  costAccumulator?: Pick<CostAccumulator, "addAPICost">;
  selectedModel?: string;
}

const log = createModuleLogger("ai.tools.generate-video");
const DEFAULT_ASPECT_RATIO = "16:9";
const DEFAULT_DURATION_SECONDS = 5;
const ALLOWED_EXTENSIONS = new Set(["mp4", "webm", "mov"]);

function resolveVideoExtension(mediaType?: string): string {
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
}

async function resolveVideoModel(selectedModel?: string): Promise<string> {
  if (selectedModel) {
    try {
      const models = await getActiveGateway().fetchModels();
      const model = models
        .map(toModelData)
        .find((item) => item.id === selectedModel);
      if (model?.output.video) {
        return selectedModel;
      }
    } catch {
      // Not in app models registry, fall through
    }
  }
  if (!config.ai.tools.video.enabled) {
    throw new Error("Video generation is not enabled");
  }
  return config.ai.tools.video.default;
}

export const generateVideoTool = ({
  costAccumulator,
  selectedModel,
}: GenerateVideoProps = {}) =>
  tool({
    description:
      "Generate a short video clip from a text prompt. Use this when the user asks to create, make, or generate a video.",
    inputSchema: generateVideoInput,
    execute: async (
      { prompt, aspectRatio, durationSeconds },
      { abortSignal }
    ) => {
      abortSignal?.throwIfAborted();
      const startMs = Date.now();
      const finalAspectRatio = aspectRatio ?? DEFAULT_ASPECT_RATIO;
      const finalDurationSeconds = durationSeconds ?? DEFAULT_DURATION_SECONDS;

      log.info(
        {
          promptLength: prompt.length,
          selectedModel,
          aspectRatio: finalAspectRatio,
          durationSeconds: finalDurationSeconds,
        },
        "generateVideo: start"
      );

      try {
        const modelId = await resolveVideoModel(selectedModel);
        const isGoogleModel =
          modelId.startsWith("google/") || modelId.includes("gemini");

        log.debug({ modelId }, "generateVideo: resolved model");

        const videoModel = getActiveGateway().createVideoModel(modelId);
        if (!videoModel) {
          throw new Error("The active gateway does not support video models.");
        }
        const result = await generateVideo({
          model: videoModel,
          abortSignal,
          prompt,
          aspectRatio: finalAspectRatio,
          duration: finalDurationSeconds,
          providerOptions: {
            ...(isGoogleModel && {
              google: {
                aspectRatio: finalAspectRatio,
              },
            }),
          },
        });

        costAccumulator?.addAPICost("generateVideo", COST_CENTS);

        const video = result.video;
        if (!video) {
          throw new Error("No video generated");
        }

        const buffer = Buffer.from(video.uint8Array);
        const timestamp = Date.now();
        const ext = resolveVideoExtension(video.mediaType);
        const filename = `generated-video-${timestamp}.${ext}`;
        const uploaded = await uploadFile(filename, buffer, video.mediaType);

        log.info(
          {
            ms: Date.now() - startMs,
            modelId,
            videoUrl: uploaded.url,
          },
          "generateVideo: success"
        );

        return { videoUrl: uploaded.url, prompt };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "";
        const isUnsupportedVideoGateway = errorMessage.includes(
          "does not support video models"
        );

        log.error(
          {
            ms: Date.now() - startMs,
            selectedModel,
            error:
              error instanceof Error
                ? { message: error.message, name: error.name }
                : error,
          },
          "generateVideo: failure"
        );

        if (isUnsupportedVideoGateway) {
          throw new Error(
            "Video generation is not available for the active gateway."
          );
        }

        throw error;
      }
    },
  });
