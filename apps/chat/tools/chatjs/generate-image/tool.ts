import {
  type FileUIPart,
  generateImage,
  generateText,
  type ToolExecutionOptions,
  tool,
} from "ai";
import { z } from "zod";
import { type AppModelId, getAppModelDefinition } from "@/lib/ai/app-models";
import { getImageModel, getMultimodalImageModel } from "@/lib/ai/providers";
import type { ChatToolContext } from "@/lib/ai/tool-context";
import { config } from "@/lib/config";
import type { CostAccumulator } from "@/lib/credits/cost-accumulator";
import { downloadFile, uploadFile } from "@/lib/file-storage";
import { keyFromFileUrl } from "@/lib/file-url";
import { createModuleLogger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/url";

const log = createModuleLogger("ai.tools.generate-image");

type ImageMode = "edit" | "generate";

/**
 * Resolve which model to use for image generation and whether it's a
 * multimodal language model (uses generateText) or a dedicated image model
 * (uses generateImage). Uses the dynamic model registry so it works across
 * all gateways, not just the static models.generated snapshot.
 */
async function resolveImageModel(
  selectedModel?: string
): Promise<
  | { modelId: string; multimodal: true; usageModelId: AppModelId }
  | { modelId: string; multimodal: false; usageModelId?: never }
> {
  // If the user's selected chat model can generate images, prefer it
  if (selectedModel) {
    try {
      const model = await getAppModelDefinition(selectedModel as AppModelId);
      if (model.output.image) {
        return {
          modelId: model.apiModelId,
          usageModelId: model.id,
          multimodal: true,
        };
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
  if (!defaultId) {
    throw new Error(
      "Set ai.tools.image.default to an image model supported by your gateway."
    );
  }
  try {
    const model = await getAppModelDefinition(defaultId as AppModelId);
    // Default could be a multimodal language model (e.g. gemini-3-pro-image)
    if (model.output.image) {
      return {
        modelId: model.apiModelId,
        usageModelId: model.id,
        multimodal: true,
      };
    }
  } catch {
    // Not in app models registry → dedicated image model (e.g. dall-e-3)
  }

  return { modelId: defaultId, multimodal: false };
}

const INLINE_IMAGE =
  /^data:image\/(?:png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/;

async function fetchImageBuffer(value: string): Promise<Buffer> {
  // Inline images do not initiate a network request.
  const inline = INLINE_IMAGE.exec(value);
  if (inline) {
    return Buffer.from(inline[1], "base64");
  }
  const url = new URL(value, getBaseUrl());
  const origin = new URL(getBaseUrl()).origin;
  const key = keyFromFileUrl(value);
  if (url.origin !== origin || url.username || url.password || !key) {
    throw new Error(
      "Image editing only accepts uploaded ChatJS files or inline images."
    );
  }
  // Read the configured storage directly. Never follow user-supplied URLs or redirects.
  return Buffer.from(await (await downloadFile(key)).arrayBuffer());
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
    return { name: err.name, message: err.message, stack: err.stack };
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
    return await (error as Promise<unknown>).catch((e) => e);
  }
  return error;
}

function getErrorDebugInfo(err: unknown) {
  return {
    errorType: typeof err,
    errorConstructor: (err as { constructor?: { name?: string } })?.constructor
      ?.name,
    errorKeys: err && typeof err === "object" ? Object.keys(err) : [],
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
  if (!imageDefault) {
    throw new Error(
      "Set ai.tools.image.default to an image model supported by your gateway."
    );
  }
  let promptInput:
    | string
    | {
        text: string;
        images: Buffer[];
      };

  if (mode === "edit") {
    log.debug(
      {
        note: "OpenAI edit mode",
        lastGeneratedCount: lastGeneratedImage ? 1 : 0,
        attachmentCount: imageParts.length,
      },
      "generateImage: preparing edit images"
    );

    const inputImages = await collectEditImages({
      imageParts,
      lastGeneratedImage,
    });
    promptInput = { text: prompt, images: inputImages };
  } else {
    promptInput = prompt;
  }

  const res = await generateImage({
    model: getImageModel(imageDefault),
    prompt: promptInput,
    n: 1,
    providerOptions: {
      telemetry: { isEnabled: true },
    },
  });

  log.debug(
    {
      mode,
      base64Length: res.images?.[0]?.base64?.length ?? 0,
    },
    "generateImage: provider response received"
  );

  const buffer = Buffer.from(res.images[0].base64, "base64");
  const timestamp = Date.now();
  const filename = `generated-image-${timestamp}.png`;
  const result = await uploadFile(filename, buffer, "image/png");

  costAccumulator?.addImageCost(
    imageDefault,
    res.images.length,
    res.usage ?? {},
    "generateImage-traditional"
  );

  log.info(
    {
      mode,
      ms: Date.now() - startMs,
      imageUrl: result.url,
      uploadedFilename: filename,
    },
    "generateImage: success"
  );

  return { imageUrl: result.url, prompt };
}

async function runGenerateImageMultimodal({
  modelId,
  usageModelId,
  mode,
  prompt,
  imageParts,
  lastGeneratedImage,
  startMs,
  costAccumulator,
}: {
  modelId: string;
  usageModelId: AppModelId;
  mode: ImageMode;
  prompt: string;
  imageParts: FileUIPart[];
  lastGeneratedImage: { imageUrl: string; name: string } | null;
  startMs: number;
  costAccumulator?: CostAccumulator;
}): Promise<{ imageUrl: string; prompt: string }> {
  // Build messages with image context if in edit mode
  interface ImageContent {
    image: Buffer;
    type: "image";
  }
  interface TextContent {
    text: string;
    type: "text";
  }
  const userContent: Array<TextContent | ImageContent> = [];

  if (mode === "edit") {
    for (const image of await collectEditImages({
      imageParts,
      lastGeneratedImage,
    })) {
      userContent.push({ type: "image", image });
    }
  }

  // Add the prompt with instruction to generate image
  userContent.push({
    type: "text",
    text:
      mode === "edit"
        ? `Based on the provided image(s), ${prompt}`
        : `Generate an image: ${prompt}`,
  });

  log.debug(
    {
      modelId,
      mode,
      imageCount: userContent.filter((c) => c.type === "image").length,
    },
    "generateImage: using multimodal model"
  );

  const isGoogleModel =
    modelId.startsWith("google/") || modelId.includes("gemini");
  const isOpenAIModel = modelId.startsWith("openai/");

  const res = await generateText({
    model: getMultimodalImageModel(modelId),
    messages: [{ role: "user", content: userContent }],
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
      usageModelId,
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
      mode,
      mediaType: imageFile.mediaType,
      hasBase64: !!imageFile.base64,
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
      mode,
      modelId,
      ms: Date.now() - startMs,
      imageUrl: result.url,
      uploadedFilename: filename,
    },
    "generateImage: multimodal success"
  );

  return { imageUrl: result.url, prompt };
}

export const generateImageTool = tool({
  description: `Generate an image from a user-provided prompt.

The assistant may make small, neutral adjustments to improve clarity, composition, or technical quality, while strictly preserving the user’s original intent, meaning, and message.

The assistant must not add new subjects, claims, branding, or alter the tone or intent of the prompt.
`,
  inputSchema: z.object({
    prompt: z
      .string()
      .describe(
        "The user’s image prompt. The original intent, message, and meaning must remain unchanged. No new ideas, claims, or content may be introduced."
      ),
  }),
  execute: async (
    { prompt },
    { context }: ToolExecutionOptions<ChatToolContext>
  ): Promise<{ imageUrl: string; prompt: string }> => {
    const {
      attachments = [],
      lastGeneratedImage = null,
      selectedModel,
      costAccumulator,
    } = context ?? {};
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
        mode,
        selectedModel,
        attachmentCount: imageParts.length,
        hasLastGeneratedImage: lastGeneratedImage !== null,
        promptLength: prompt.length,
      },
      "generateImage: start"
    );

    try {
      const {
        modelId: effectiveModelId,
        multimodal,
        usageModelId,
      } = await resolveImageModel(selectedModel);

      // Use multimodal path for language models with image generation
      if (multimodal) {
        return await runGenerateImageMultimodal({
          modelId: effectiveModelId,
          usageModelId,
          mode,
          prompt,
          imageParts,
          lastGeneratedImage,
          startMs,
          costAccumulator,
        });
      }

      // Traditional image generation for dedicated image models
      return await runGenerateImageTraditional({
        mode,
        prompt,
        imageParts,
        lastGeneratedImage,
        startMs,
        costAccumulator,
      });
    } catch (error) {
      const resolvedError = await resolveError(error);
      log.error(
        {
          mode,
          selectedModel,
          ms: Date.now() - startMs,
          error: serializeError(resolvedError),
          ...getErrorDebugInfo(resolvedError),
        },
        "generateImage: failure"
      );
      throw resolvedError;
    }
  },
});
