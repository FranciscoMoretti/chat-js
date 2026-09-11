import { type FileUIPart, generateImage, generateText, tool } from "ai";
import { getActiveGateway } from "@/lib/ai/active-gateway";
import type { AppModelId } from "@/lib/ai/app-models";
import { toModelData } from "@/lib/ai/to-model-data";
import { config } from "@/lib/config";
import type { CostAccumulator } from "@/lib/credits/cost-accumulator";
import { downloadFile, uploadFile } from "@/lib/file-storage";
import { keyFromFileUrl } from "@/lib/file-url";
import { createModuleLogger } from "@/lib/logger";
import { generateImageInput } from "./generate-image.schemas";

interface GenerateImageProps {
  attachments?: FileUIPart[];
  costAccumulator?: Pick<CostAccumulator, "addLLMCost">;
  lastGeneratedImage?: { imageUrl: string; name: string } | null;
  selectedModel?: string;
  storeFile?: typeof uploadFile;
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
  if (!config.ai.tools.image.enabled) {
    throw new Error("Image generation is not enabled");
  }
  const defaultId = config.ai.tools.image.default;
  const models = (await getActiveGateway().fetchModels()).map(toModelData);
  const selected = models.find((model) => model.id === selectedModel);
  if (selected?.type === "language" && selected.output.image) {
    return { modelId: selected.id, multimodal: true };
  }
  const fallback = models.find((model) => model.id === defaultId);
  return {
    modelId: defaultId,
    multimodal: fallback?.type === "language" && fallback.output.image,
  };
}

async function fetchImageBuffer(
  url: string,
  abortSignal?: AbortSignal
): Promise<Buffer> {
  abortSignal?.throwIfAborted();
  const key = url.startsWith("/api/files/content?")
    ? keyFromFileUrl(url)
    : null;
  if (key) {
    const file = await downloadFile(key);
    abortSignal?.throwIfAborted();
    return Buffer.from(await file.arrayBuffer());
  }
  if (!url.startsWith("data:image/")) {
    throw new Error("Use a ChatJS image upload or embedded image.");
  }
  const response = await fetch(url, { signal: abortSignal });
  return Buffer.from(await response.arrayBuffer());
}

async function collectEditImages({
  imageParts,
  lastGeneratedImage,
  abortSignal,
}: {
  imageParts: FileUIPart[];
  lastGeneratedImage: { imageUrl: string; name: string } | null;
  abortSignal?: AbortSignal;
}): Promise<Buffer[]> {
  return await Promise.all([
    ...(lastGeneratedImage
      ? [fetchImageBuffer(lastGeneratedImage.imageUrl, abortSignal)]
      : []),
    ...imageParts.map((part) => fetchImageBuffer(part.url, abortSignal)),
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
  abortSignal,
  storeFile,
}: {
  storeFile: typeof uploadFile;
  mode: ImageMode;
  prompt: string;
  imageParts: FileUIPart[];
  lastGeneratedImage: { imageUrl: string; name: string } | null;
  startMs: number;
  costAccumulator?: Pick<CostAccumulator, "addLLMCost">;
  abortSignal?: AbortSignal;
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
        note: "OpenAI edit mode",
        lastGeneratedCount: lastGeneratedImage ? 1 : 0,
        attachmentCount: imageParts.length,
      },
      "generateImage: preparing edit images"
    );

    const inputImages = await collectEditImages({
      imageParts,
      lastGeneratedImage,
      abortSignal,
    });
    promptInput = { text: prompt, images: inputImages };
  } else {
    promptInput = prompt;
  }

  const model = getActiveGateway().createImageModel(imageDefault);
  if (!model) {
    throw new Error(
      "The active gateway does not support dedicated image models."
    );
  }
  const res = await generateImage({
    model,
    abortSignal,
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

  costAccumulator?.addLLMCost(
    imageDefault as AppModelId,
    {
      inputTokens: res.usage?.inputTokens,
      outputTokens: res.usage?.outputTokens,
    },
    "generateImage-traditional"
  );

  const buffer = Buffer.from(res.images[0].base64, "base64");
  const timestamp = Date.now();
  const filename = `generated-image-${timestamp}.png`;
  const result = await storeFile(filename, buffer, "image/png");

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
  mode,
  prompt,
  imageParts,
  lastGeneratedImage,
  startMs,
  costAccumulator,
  abortSignal,
  storeFile,
}: {
  storeFile: typeof uploadFile;
  modelId: string;
  mode: ImageMode;
  prompt: string;
  imageParts: FileUIPart[];
  lastGeneratedImage: { imageUrl: string; name: string } | null;
  startMs: number;
  costAccumulator?: Pick<CostAccumulator, "addLLMCost">;
  abortSignal?: AbortSignal;
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
    const images = await collectEditImages({
      imageParts,
      lastGeneratedImage,
      abortSignal,
    });
    for (const image of images) {
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
    model: getActiveGateway().createLanguageModel(modelId),
    abortSignal,
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

  costAccumulator?.addLLMCost(
    modelId as AppModelId,
    res.usage ?? {},
    "generateImage-multimodal"
  );

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
  const result = await storeFile(filename, buffer, imageFile.mediaType);

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

export const generateImageTool = ({
  storeFile = uploadFile,
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
    inputSchema: generateImageInput,
    execute: async ({ prompt }, { abortSignal }) => {
      abortSignal?.throwIfAborted();
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
        const { modelId: effectiveModelId, multimodal } =
          await resolveImageModel(selectedModel);

        // Use multimodal path for language models with image generation
        if (multimodal) {
          return await runGenerateImageMultimodal({
            modelId: effectiveModelId,
            mode,
            prompt,
            imageParts,
            lastGeneratedImage,
            startMs,
            costAccumulator,
            abortSignal,
            storeFile,
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
          abortSignal,
          storeFile,
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
