import { experimental_generateVideo as generateVideo, tool } from "ai";
import { z } from "zod";

import { getAppModelDefinition } from "@/lib/ai/app-models";
import type { AppModelId } from "@/lib/ai/app-models";
import { getVideoModel } from "@/lib/ai/providers";
import { config } from "@/lib/config";
import type { CostAccumulator } from "@/lib/credits/cost-accumulator";
import { uploadFile } from "@/lib/file-storage";
import { createModuleLogger } from "@/lib/logger";

const COST_CENTS = 50; // Fixed estimate — not yet available from provider API

interface GenerateVideoProps {
  costAccumulator?: CostAccumulator;
  selectedModel?: string;
}

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

const resolveVideoModel = async (selectedModel?: string): Promise<string> => {
  if (selectedModel) {
    try {
      const model = await getAppModelDefinition(selectedModel as AppModelId);
      if (model.output.video) {
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
};

export const generateVideoTool = ({
  costAccumulator,
  selectedModel,
}: GenerateVideoProps = {}) =>
  tool({
    description:
      "Generate a short video clip from a text prompt. Use this when the user asks to create, make, or generate a video.",
    execute: async ({ prompt, aspectRatio, durationSeconds }) => {
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
        const modelId = await resolveVideoModel(selectedModel);
        const isGoogleModel =
          modelId.startsWith("google/") || modelId.includes("gemini");

        log.debug({ modelId }, "generateVideo: resolved model");

        const result = await generateVideo({
          aspectRatio: finalAspectRatio,
          duration: finalDurationSeconds,
          model: getVideoModel(modelId),
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

        const buffer = Buffer.from(video.uint8Array);
        const timestamp = Date.now();
        const ext = resolveVideoExtension(video.mediaType);
        const filename = `generated-video-${timestamp}.${ext}`;
        const uploaded = await uploadFile(filename, buffer, video.mediaType);

        costAccumulator?.addAPICost("generateVideo", COST_CENTS);

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
    inputSchema: z.object({
      aspectRatio: z
        .enum(["16:9", "9:16", "1:1"])
        .optional()
        .describe("Optional output aspect ratio. Defaults to 16:9."),
      durationSeconds: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .describe("Optional video duration in seconds. Defaults to 5."),
      prompt: z
        .string()
        .describe("A descriptive prompt for the video to generate."),
    }),
  });
