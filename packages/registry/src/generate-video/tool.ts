import { experimental_generateVideo as aiGenerateVideo, tool } from "ai";
import { z } from "zod";
import {
  defineTool,
  type ToolRuntimeContext,
} from "@toolkit/lib/runtime";

const COST_CENTS = 50; // Fixed estimate; provider APIs do not report actual cost.
const DEFAULT_ASPECT_RATIO = "16:9";
const DEFAULT_DURATION_SECONDS = 5;
const ALLOWED_EXTENSIONS = new Set(["mp4", "webm", "mov"]);

function resolveVideoExtension(mediaType?: string): string {
  if (!mediaType) {
    return "mp4";
  }

  const [, subtypeWithParams] = mediaType.split("/");
  const subtype = subtypeWithParams?.split(";")[0]?.trim().toLowerCase();
  if (!subtype) {
    return "mp4";
  }

  const mappedSubtype = subtype === "quicktime" ? "mov" : subtype;
  return ALLOWED_EXTENSIONS.has(mappedSubtype) ? mappedSubtype : "mp4";
}

function getModelId(model: unknown): string | null {
  if (model && typeof model === "object" && "modelId" in model) {
    return String((model as { modelId: unknown }).modelId);
  }
  return null;
}

export const generateVideo = defineTool({
  id: "generate-video",
  needs: ["models.video", "media.write"],
  createTool: (ctx: ToolRuntimeContext) =>
    tool({
      description:
        "Generate a short video clip from a text prompt. Use this when the user asks to create, make, or generate a video.",
      inputSchema: z.object({
        prompt: z
          .string()
          .describe("A descriptive prompt for the video to generate."),
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
      }),
      execute: async (
        { prompt, aspectRatio, durationSeconds },
        { abortSignal }
      ) => {
        const finalAspectRatio = aspectRatio ?? DEFAULT_ASPECT_RATIO;
        const finalDurationSeconds =
          durationSeconds ?? DEFAULT_DURATION_SECONDS;
        const model = await ctx.models.video({ purpose: "generate-video" });
        const modelId = getModelId(model);
        const isGoogleModel =
          modelId?.startsWith("google/") || modelId?.includes("gemini");

        const result = await aiGenerateVideo({
          abortSignal,
          aspectRatio: finalAspectRatio,
          duration: finalDurationSeconds,
          model,
          prompt,
          providerOptions: {
            ...(isGoogleModel && {
              google: {
                aspectRatio: finalAspectRatio,
              },
            }),
          },
        });

        if (!result.video) {
          throw new Error("No video generated");
        }
        ctx.cost.addAPICost("generateVideo", COST_CENTS);

        const extension = resolveVideoExtension(result.video.mediaType);
        const stored = await ctx.media.write({
          bytes: result.video.uint8Array,
          filename: `generated-video-${Date.now()}.${extension}`,
          mediaType: result.video.mediaType,
        });
        return {
          prompt,
          videoUrl: stored.url,
        };
      },
      toModelOutput: ({ output }) => ({
        type: "json",
        value: {
          prompt: output.prompt,
          videoUrl: output.videoUrl,
        },
      }),
    }),
} as const);
