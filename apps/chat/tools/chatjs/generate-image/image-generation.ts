import { generateImage, generateText } from "ai";
import type { FileUIPart } from "ai";
import type { FileUploader } from "@/lib/file-storage";
import type { ImageModelSelection } from "./image-model";
import type { ToolModelProvider } from "@/lib/ai/tool-context";
import type { createEveToolCost } from "@/lib/eve/tool-cost";
import { createModuleLogger } from "@/lib/logger";
// oxlint-disable-next-line sort-imports -- Keep Pino/config initialization before image-input loads file-storage/database/environment validation; sorting collectEditImages first reverses the logger/validation failure order.
import { collectEditImages } from "./image-input";
import type { generateImageResult } from "./schemas";
import type { z } from "zod";

const log = createModuleLogger("ai.tools.generate-image");
const EMPTY_IMAGE_BYTES = 0;
const GENERATED_IMAGE_COUNT = 1;
const NO_GENERATED_IMAGES = 0;
type ReadonlyNativeSurface<Value> = Value extends
  | string
  | number
  | bigint
  | boolean
  | symbol
  | null
  | undefined
  ? Value
  : Value extends (...parameters: readonly never[]) => unknown
    ? Value
    : Value extends abstract new (...parameters: readonly never[]) => unknown
      ? Value
      : Value extends object
        ? {
            readonly [Property in keyof Value]: ReadonlyNativeSurface<
              Value[Property]
            >;
          }
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
      // oxlint-disable-next-line no-ternary -- Keep lastGeneratedCount as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
      // oxlint-disable-next-line oxc/no-rest-spread-properties, no-ternary -- Conditional spread (model.multimodal ? { modelId: model.modelId } : {}) preserves the selected branch's own keys/values and positional overrides, including absent keys when a branch contributes none; pinned eslint/prefer-object-spread rejects Object.assign.; no-ternary: Keep object spread as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      ...(model.multimodal ? { modelId: model.modelId } : {}),
    },
    // oxlint-disable-next-line no-ternary -- Keep log.info argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading length from firstImage.base64; read base64 from firstImage; preserve one receiver evaluation, skipped accesses and the existing EMPTY_IMAGE_BYTES fallback.
      base64Length: firstImage?.base64?.length ?? EMPTY_IMAGE_BYTES,
      mode: options.mode,
    },
    "generateImage: provider response received"
  );
  const buffer = Buffer.from(firstImage.base64, "base64");
  const timestamp = Date.now();
  const filename = `generated-image-${timestamp}.png`;
  // Provider usage remains billable if the subsequent storage upload fails.
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading addImageCost from options.costAccumulator; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
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
    // oxlint-disable-next-line no-ternary -- Keep buffers as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
        // oxlint-disable-next-line no-ternary -- Keep text as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
  // oxlint-disable-next-line no-ternary -- Keep ext as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Conditional spread ((modelId.startsWith("google/") || modelId.includes("gemini")) && {     google: { responseModalities: ["TEXT", "IMAGE"] },   }) preserves the selected branch's own keys/values and positional overrides, including absent keys when a branch contributes none; pinned eslint/prefer-object-spread rejects Object.assign.
  ...((modelId.startsWith("google/") || modelId.includes("gemini")) && {
    google: { responseModalities: ["TEXT", "IMAGE"] },
  }),
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Conditional spread (modelId.startsWith("openai/") && {     openai: { modalities: ["text", "image"] },   }) preserves the selected branch's own keys/values and positional overrides, including absent keys when a branch contributes none; pinned eslint/prefer-object-spread rejects Object.assign.
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
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading addLLMCost from options.costAccumulator; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
  options.costAccumulator?.addLLMCost(
    selection.usageModelId,
    res.usage,
    "generateImage-multimodal"
  );
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading find from res.files; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
  const imageFile = res.files?.find(
    (file: Readonly<{ mediaType: string }>): boolean =>
      file.mediaType.startsWith("image/")
  );
  if (!imageFile) {
    throw new Error("No image generated by multimodal model");
  }
  return await storeMultimodalImage(options, selection, imageFile);
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (runGenerateImageTraditional, runGenerateImageMultimodal); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable oxc/no-async-await */
export { runGenerateImageTraditional, runGenerateImageMultimodal };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (ImageGenerationOptions, GeneratedImageResult, ImageStoreFile); the enabled import/no-default-export convention rejects the default-export alternative. */
export type { ImageGenerationOptions, GeneratedImageResult, ImageStoreFile };
/* oxlint-enable import/no-named-export */
