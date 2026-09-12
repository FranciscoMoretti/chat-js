import { generateImage, generateText, tool } from "ai";
import type { FileUIPart } from "ai";
import { z } from "zod";

import { getAppModelDefinition } from "@/lib/ai/app-models";
import type { AppModelId } from "@/lib/ai/app-models";
import { getImageModel, getMultimodalImageModel } from "@/lib/ai/providers";
import { config } from "@/lib/config";
import type { CostAccumulator } from "@/lib/credits/cost-accumulator";
import { uploadFile } from "@/lib/file-storage";
import { createModuleLogger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/url";

interface GenerateImageProps {
  attachments?: FileUIPart[];
  costAccumulator?: CostAccumulator;
  lastGeneratedImage?: { imageUrl: string; name: string } | null;
  selectedModel?: string;
}

const log = createModuleLogger("ai.tools.generate-image");

type ImageMode = "edit" | "generate";

/**
 * Resolve which model to use for image generation and whether it's a
 * multimodal language model (uses generateText) or a dedicated image model
 * (uses generateImage). Uses the dynamic model registry so it works across
 * all gateways, not just the static models.generated snapshot.
 */
async function resolveImageModel(selectedModel?: string): Promise<{
  modelId: string;
  multimodal: boolean;
}> {
  // If the user's selected chat model can generate images, prefer it
  if (selectedModel) {
    try {
      const model = await getAppModelDefinition(selectedModel as AppModelId);
      if (model.output.image) {
        return { modelId: selectedModel, multimodal: true };
      }
    } catch {
      // Not in app models registry, fall through
    }
  }

  // Fall back to the configured default image model
  if (!config.ai.tools.image.enabled) {
    throw new Error("Image generation is not enabled");
  }
  const defaultId = config.ai.tools.image.default;
  try {
    const model = await getAppModelDefinition(defaultId as AppModelId);
    // Default could be a multimodal language model (e.g. gemini-3-pro-image)
    if (model.output.image) {
      return { modelId: defaultId, multimodal: true };
    }
  } catch {
    // Not in app models registry → dedicated image model (e.g. dall-e-3)
  }

  return { modelId: defaultId, multimodal: false };
}

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const response = await fetch(new URL(url, getBaseUrl()));
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function collectEditImages({
  imageParts,
  lastGeneratedImage,
}: {
  imageParts: FileUIPart[];
  lastGeneratedImage: { imageUrl: string; name: string } | null;
}): Promise<Buffer[]> {
  return await Promise.all([
    ...(lastGeneratedImage
      ? [fetchImageBuffer(lastGeneratedImage.imageUrl)]
      : []),
    ...imageParts.map((p) => fetchImageBuffer(p.url)),
  ]);
}

function serializeError(err: unknown): {
  name?: string;
  message: string;
  stack?: string;
  raw?: unknown;
} {
  if (err instanceof Error) {
    return { message: err.message, name: err.name, stack: err.stack };
  }

  // Handle Promise-like objects (shouldn't happen but does sometimes)
  if (err && typeof err === "object" && "then" in err) {
    return { message: "Error was a Promise - check raw", raw: err };
  }

  // Handle objects with message property
  if (err && typeof err === "object" && "message" in err) {
    const e = err as { message: unknown; name?: unknown };
    return {
      message: String(e.message),
      name: e.name ? String(e.name) : undefined,
    };
  }

  return { message: String(err), raw: err };
}

async function resolveError(error: unknown): Promise<unknown> {
  if (error && typeof error === "object" && "then" in error) {
    return await (error as Promise<unknown>).catch(
      (caughtError) => caughtError
    );
  }
  return error;
}

function getErrorDebugInfo(err: unknown) {
  return {
    errorConstructor: (err as { constructor?: { name?: string } })?.constructor
      ?.name,
    errorKeys: err && typeof err === "object" ? Object.keys(err) : [],
    errorType: typeof err,
  };
}

async function runGenerateImageTraditional({
  mode,
  prompt,
  imageParts,
  lastGeneratedImage,
  startMs,
  costAccumulator,
}: {
  mode: ImageMode;
  prompt: string;
  imageParts: FileUIPart[];
  lastGeneratedImage: { imageUrl: string; name: string } | null;
  startMs: number;
  costAccumulator?: CostAccumulator;
}): Promise<{ imageUrl: string; prompt: string }> {
  if (!config.ai.tools.image.enabled) {
    throw new Error("Image generation is not enabled");
  }
  const imageDefault = config.ai.tools.image.default;
  let promptInput:
    | string
    | {
        text: string;
        images: Buffer[];
      };

  if (mode === "edit") {
    log.debug(
      {
        attachmentCount: imageParts.length,
        lastGeneratedCount: lastGeneratedImage ? 1 : 0,
        note: "OpenAI edit mode",
      },
      "generateImage: preparing edit images"
    );

    const inputImages = await collectEditImages({
      imageParts,
      lastGeneratedImage,
    });
    promptInput = { images: inputImages, text: prompt };
  } else {
    promptInput = prompt;
  }

  const res = await generateImage({
    model: getImageModel(imageDefault),
    n: 1,
    prompt: promptInput,
    providerOptions: {
      telemetry: { isEnabled: true },
    },
  });

  log.debug(
    {
      base64Length: res.images?.[0]?.base64?.length ?? 0,
      mode,
    },
    "generateImage: provider response received"
  );

  const buffer = Buffer.from(res.images[0].base64, "base64");
  const timestamp = Date.now();
  const filename = `generated-image-${timestamp}.png`;
  const result = await uploadFile(filename, buffer, "image/png");

  if (res.usage) {
    costAccumulator?.addLLMCost(
      imageDefault as AppModelId,
      {
        inputTokens: res.usage.inputTokens,
        outputTokens: res.usage.outputTokens,
      },
      "generateImage-traditional"
    );
  }

  log.info(
    {
      imageUrl: result.url,
      mode,
      ms: Date.now() - startMs,
      uploadedFilename: filename,
    },
    "generateImage: success"
  );

  return { imageUrl: result.url, prompt };
}

async function runGenerateImageMultimodal({
  modelId,
  mode,
  prompt,
  imageParts,
  lastGeneratedImage,
  startMs,
  costAccumulator,
}: {
  modelId: string;
  mode: ImageMode;
  prompt: string;
  imageParts: FileUIPart[];
  lastGeneratedImage: { imageUrl: string; name: string } | null;
  startMs: number;
  costAccumulator?: CostAccumulator;
}): Promise<{ imageUrl: string; prompt: string }> {
  // Build messages with image context if in edit mode
  interface ImageContent {
    image: URL;
    type: "image";
  }
  interface TextContent {
    text: string;
    type: "text";
  }
  const userContent: (TextContent | ImageContent)[] = [];

  // Add reference images if in edit mode
  if (mode === "edit") {
    if (lastGeneratedImage) {
      userContent.push({
        image: new URL(lastGeneratedImage.imageUrl, getBaseUrl()),
        type: "image",
      });
    }
    for (const part of imageParts) {
      userContent.push({
        image: new URL(part.url, getBaseUrl()),
        type: "image",
      });
    }
  }

  // Add the prompt with instruction to generate image
  userContent.push({
    text:
      mode === "edit"
        ? `Based on the provided image(s), ${prompt}`
        : `Generate an image: ${prompt}`,
    type: "text",
  });

  log.debug(
    {
      imageCount: userContent.filter((c) => c.type === "image").length,
      mode,
      modelId,
    },
    "generateImage: using multimodal model"
  );

  const isGoogleModel =
    modelId.startsWith("google/") || modelId.includes("gemini");
  const isOpenAIModel = modelId.startsWith("openai/");

  const res = await generateText({
    messages: [{ content: userContent, role: "user" }],
    model: getMultimodalImageModel(modelId),
    providerOptions: {
      ...(isGoogleModel && {
        google: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      }),
      ...(isOpenAIModel && {
        openai: {
          modalities: ["text", "image"],
        },
      }),
    },
  });

  // Track LLM cost for multimodal image generation

  if (res.usage) {
    costAccumulator?.addLLMCost(
      modelId as AppModelId,
      res.usage,
      "generateImage-multimodal"
    );
  }

  // Find the first image in the response files
  const imageFile = res.files?.find((f) => f.mediaType.startsWith("image/"));
  if (!imageFile) {
    throw new Error("No image generated by multimodal model");
  }

  log.debug(
    {
      hasBase64: !!imageFile.base64,
      mediaType: imageFile.mediaType,
      mode,
    },
    "generateImage: multimodal response received"
  );

  const buffer = Buffer.from(imageFile.uint8Array);
  const timestamp = Date.now();
  const ext = imageFile.mediaType.split("/")[1] || "png";
  const filename = `generated-image-${timestamp}.${ext}`;
  const result = await uploadFile(filename, buffer, imageFile.mediaType);

  log.info(
    {
      imageUrl: result.url,
      mode,
      modelId,
      ms: Date.now() - startMs,
      uploadedFilename: filename,
    },
    "generateImage: multimodal success"
  );

  return { imageUrl: result.url, prompt };
}

export const generateImageTool = ({
  attachments = [],
  lastGeneratedImage = null,
  selectedModel,
  costAccumulator,
}: GenerateImageProps = {}) =>
  tool({
    description: `Generate an image from a user-provided prompt.

The assistant may make small, neutral adjustments to improve clarity, composition, or technical quality, while strictly preserving the user’s original intent, meaning, and message.

The assistant must not add new subjects, claims, branding, or alter the tone or intent of the prompt.
`,
    execute: async ({ prompt }) => {
      const startMs = Date.now();
      const imageParts = attachments.filter(
        (part) => part.type === "file" && part.mediaType?.startsWith("image/")
      );

      const mode: ImageMode =
        imageParts.length > 0 || lastGeneratedImage !== null
          ? "edit"
          : "generate";

      log.info(
        {
          attachmentCount: imageParts.length,
          hasLastGeneratedImage: lastGeneratedImage !== null,
          mode,
          promptLength: prompt.length,
          selectedModel,
        },
        "generateImage: start"
      );

      try {
        const { modelId: effectiveModelId, multimodal } =
          await resolveImageModel(selectedModel);

        // Use multimodal path for language models with image generation
        if (multimodal) {
          return await runGenerateImageMultimodal({
            costAccumulator,
            imageParts,
            lastGeneratedImage,
            mode,
            modelId: effectiveModelId,
            prompt,
            startMs,
          });
        }

        // Traditional image generation for dedicated image models
        return await runGenerateImageTraditional({
          costAccumulator,
          imageParts,
          lastGeneratedImage,
          mode,
          prompt,
          startMs,
        });
      } catch (error) {
        const resolvedError = await resolveError(error);
        log.error(
          {
            error: serializeError(resolvedError),
            mode,
            ms: Date.now() - startMs,
            selectedModel,
            ...getErrorDebugInfo(resolvedError),
          },
          "generateImage: failure"
        );
        throw resolvedError;
      }
    },
    inputSchema: z.object({
      prompt: z
        .string()
        .describe(
          "The user’s image prompt. The original intent, message, and meaning must remain unchanged. No new ideas, claims, or content may be introduced."
        ),
    }),
  });
