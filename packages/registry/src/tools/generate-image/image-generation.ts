import { generateImage, generateText } from "ai";
import type { FileUIPart } from "ai";
import type { z } from "zod";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ToolModelProvider } from "@/lib/ai/tool-context";
/* oxlint-enable sort-imports */
import type { createEveToolCost } from "@/lib/eve/tool-cost";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { FileUploader } from "@/lib/file-storage";
/* oxlint-enable sort-imports */
import { createModuleLogger } from "@/lib/logger";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { collectEditImages } from "./image-input";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ImageModelSelection } from "./image-model";
/* oxlint-enable sort-imports */
import type { generateImageResult } from "./schemas";

const log = createModuleLogger("ai.tools.generate-image");
const EMPTY_IMAGE_BYTES = 0;
const GENERATED_IMAGE_COUNT = 1;
const NO_GENERATED_IMAGES = 0;
type ReadonlyNativeSurface<Value> = Value extends (
  ...args: readonly never[]
) => unknown
  ? Value
  : Value extends object
    ? { readonly [Key in keyof Value]: ReadonlyNativeSurface<Value[Key]> }
    : Value;
type ImageStoreFile = (
  filename: string,
  body: ReadonlyNativeSurface<Buffer>,
  mediaType?: string
) => ReturnType<FileUploader>;
type ImageMode = "edit" | "generate";
interface ImageGenerationOptions {
  readonly mode: ImageMode;
  readonly prompt: string;
  readonly imageParts: readonly Readonly<Pick<FileUIPart, "url">>[];
  readonly lastGeneratedImage: Readonly<{
    imageUrl: string;
    name: string;
  }> | null;
  readonly startMs: number;
  readonly costAccumulator?: Readonly<ReturnType<typeof createEveToolCost>>;
  readonly abortSignal?: Readonly<AbortSignal>;
  readonly storeFile: ImageStoreFile;
  readonly modelProvider: Readonly<ToolModelProvider>;
}
type GeneratedImageResult = Required<z.infer<typeof generateImageResult>>;
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve traditionalPrompt's awaited sequencing and rejected-Promise behavior. */
const traditionalPrompt = async (
  options: Readonly<ImageGenerationOptions>
): Promise<string | { text: string; images: Buffer[] }> => {
  if (options.mode !== "edit") {
    return options.prompt;
  }
  log.debug(
    {
      attachmentCount: options.imageParts.length,
      lastGeneratedCount: options.lastGeneratedImage
        ? GENERATED_IMAGE_COUNT
        : NO_GENERATED_IMAGES,
      note: "OpenAI edit mode",
    },
    "generateImage: preparing edit images"
  );
  return { images: await collectEditImages(options), text: options.prompt };
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve storeImage's awaited sequencing and rejected-Promise behavior. */
const storeImage = async (
  options: Readonly<ImageGenerationOptions>,
  image: Readonly<{
    buffer: ReadonlyNativeSurface<Buffer>;
    filename: string;
    mediaType: string;
  }>,
  model: Readonly<{ modelId: string; multimodal: boolean }>
): Promise<GeneratedImageResult> => {
  const result = await options.storeFile(
    image.filename,
    image.buffer,
    image.mediaType
  );
  log.info(
    {
      imageUrl: result.url,
      mode: options.mode,
      ms: Date.now() - options.startMs,
      uploadedFilename: image.filename,
      ...(model.multimodal ? { modelId: model.modelId } : {}),
    },
    model.multimodal
      ? "generateImage: multimodal success"
      : "generateImage: success"
  );
  return {
    fileId: result.fileId,
    imageUrl: result.url,
    prompt: options.prompt,
  };
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve runGenerateImageTraditional's awaited sequencing and rejected-Promise behavior. */
const runGenerateImageTraditional = async (
  options: Readonly<ImageGenerationOptions>,
  modelId: string
): Promise<GeneratedImageResult> => {
  const prompt = await traditionalPrompt(options);
  const res = await generateImage({
    abortSignal: options.abortSignal,
    model: options.modelProvider.createImageModel(modelId),
    prompt,
    providerOptions: { telemetry: { isEnabled: true } },
  });
  const [firstImage] = res.images;
  log.debug(
    {
      base64Length: firstImage?.base64?.length ?? EMPTY_IMAGE_BYTES,
      mode: options.mode,
    },
    "generateImage: provider response received"
  );
  const buffer = Buffer.from(firstImage.base64, "base64");
  const timestamp = Date.now();
  const filename = `generated-image-${timestamp}.png`;
  // Provider usage remains billable if the subsequent storage upload fails.
  options.costAccumulator?.addImageCost(
    modelId,
    res.images.length,
    res.usage ?? {},
    "generateImage-traditional"
  );
  return await storeImage(
    options,
    { buffer, filename, mediaType: "image/png" },
    { modelId, multimodal: false }
  );
};
/* oxlint-enable oxc/no-async-await */
interface ImageContent {
  image: Readonly<Buffer>;
  type: "image";
}
interface TextContent {
  text: string;
  type: "text";
}
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve multimodalContent's awaited sequencing and rejected-Promise behavior. */
const multimodalContent = async (
  options: Readonly<ImageGenerationOptions>
): Promise<(ImageContent | TextContent)[]> => {
  const buffers =
    options.mode === "edit" ? await collectEditImages(options) : [];
  const images = buffers.map(
    (image: ReadonlyNativeSurface<Buffer>): ImageContent => ({
      image,
      type: "image",
    })
  );
  return [
    ...images,
    {
      text:
        options.mode === "edit"
          ? `Based on the provided image(s), ${options.prompt}`
          : `Generate an image: ${options.prompt}`,
      type: "text",
    },
  ];
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve storeMultimodalImage's awaited sequencing and rejected-Promise behavior. */
const storeMultimodalImage = async (
  options: Readonly<ImageGenerationOptions>,
  selection: Readonly<Extract<ImageModelSelection, { multimodal: true }>>,
  imageFile: ReadonlyNativeSurface<{
    mediaType: string;
    base64: string;
    uint8Array: Uint8Array;
  }>
): Promise<GeneratedImageResult> => {
  log.debug(
    {
      hasBase64: Boolean(imageFile.base64),
      mediaType: imageFile.mediaType,
      mode: options.mode,
    },
    "generateImage: multimodal response received"
  );
  const buffer = Buffer.from(imageFile.uint8Array);
  const timestamp = Date.now();
  const [, subtype] = imageFile.mediaType.split("/");
  const ext = typeof subtype === "string" && subtype !== "" ? subtype : "png";
  return await storeImage(
    options,
    {
      buffer,
      filename: `generated-image-${timestamp}.${ext}`,
      mediaType: imageFile.mediaType,
    },
    selection
  );
};
/* oxlint-enable oxc/no-async-await */
const multimodalProviderOptions = (
  modelId: string
): {
  google?: { responseModalities: string[] };
  openai?: { modalities: string[] };
} => ({
  ...((modelId.startsWith("google/") || modelId.includes("gemini")) && {
    google: { responseModalities: ["TEXT", "IMAGE"] },
  }),
  ...(modelId.startsWith("openai/") && {
    openai: { modalities: ["text", "image"] },
  }),
});
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve runGenerateImageMultimodal's awaited sequencing and rejected-Promise behavior. */
const runGenerateImageMultimodal = async (
  options: Readonly<ImageGenerationOptions>,
  selection: Readonly<Extract<ImageModelSelection, { multimodal: true }>>
): Promise<GeneratedImageResult> => {
  const userContent = await multimodalContent(options);
  log.debug(
    {
      imageCount: userContent.filter(
        (part: Readonly<{ type: string }>): boolean => part.type === "image"
      ).length,
      mode: options.mode,
      modelId: selection.modelId,
    },
    "generateImage: using multimodal model"
  );
  const res = await generateText({
    abortSignal: options.abortSignal,
    messages: [{ content: userContent, role: "user" }],
    model: options.modelProvider.createLanguageModel(selection.modelId),
    providerOptions: multimodalProviderOptions(selection.modelId),
  });
  options.costAccumulator?.addLLMCost(
    selection.usageModelId,
    res.usage,
    "generateImage-multimodal"
  );
  const imageFile = res.files?.find(
    (file: Readonly<{ mediaType: string }>): boolean =>
      file.mediaType.startsWith("image/")
  );
  if (!imageFile) {
    throw new Error("No image generated by multimodal model");
  }
  return await storeMultimodalImage(options, selection, imageFile);
};
/* oxlint-enable oxc/no-async-await */
export { runGenerateImageTraditional, runGenerateImageMultimodal };
export type { ImageGenerationOptions, GeneratedImageResult, ImageStoreFile };
