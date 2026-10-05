import { eveGeneratedFileUploader } from "@/lib/eve/generated-files";
import { createEveToolCost } from "@/lib/eve/tool-cost";
import { eveToolImageContext } from "@/lib/eve/tool-image-context";
import { eveToolModelProvider } from "@/lib/eve/tool-models";
import { executeWithToolUsage } from "@/lib/eve/tool-usage";
import type { ToolUsage } from "@/lib/eve/tool-usage";
import { createModuleLogger } from "@/lib/logger";

import {
  ABSENT_DIAGNOSTIC_VALUE,
  getErrorDebugInfo,
  resolveError,
  serializeError,
} from "./image-errors";
import {
  runGenerateImageMultimodal,
  runGenerateImageTraditional,
} from "./image-generation";
import type {
  GeneratedImageResult,
  ImageGenerationOptions,
  ImageStoreFile,
} from "./image-generation";
import { resolveImageModel } from "./image-model";

const log = createModuleLogger("ai.tools.generate-image");
const NO_IMAGE_ATTACHMENTS = 0;
interface ImageRequestContext {
  readonly abortSignal: Readonly<AbortSignal>;
  readonly session: Readonly<{
    id: string;
    auth: Readonly<{
      current: Readonly<{
        attributes: Readonly<Record<string, unknown>>;
      }> | null;
      initiator: Readonly<{ principalId: string }> | null;
    }>;
  }>;
}
interface ImageRequest {
  readonly options: Readonly<ImageGenerationOptions>;
  readonly selectedModel: string | undefined;
}
const createImageRequest = (
  prompt: string,
  context: Readonly<ImageRequestContext>,
  usage: Readonly<ToolUsage>
): ImageRequest => {
  const costAccumulator = createEveToolCost(usage);
  const uploadFile = eveGeneratedFileUploader(context);
  // A provider generation followed by storage failure is an explicit domain result.
  const storeFile: ImageStoreFile = async (filename, body, mediaType) => {
    try {
      return await uploadFile(filename, body, mediaType);
    } catch {
      return usage.fail();
    }
  };
  const selected = context.session.auth.current?.attributes.modelId;
  const selectedModel =
    typeof selected === "string" ? selected : ABSENT_DIAGNOSTIC_VALUE;
  const { attachments, lastGeneratedImage } = eveToolImageContext.get();
  const startMs = Date.now();
  const imageParts = attachments.filter(
    (part: Readonly<{ type: string; mediaType?: string }>): boolean =>
      part.type === "file" && part.mediaType?.startsWith("image/") === true
  );
  return {
    options: {
      abortSignal: context.abortSignal,
      costAccumulator,
      imageParts,
      lastGeneratedImage,
      mode:
        imageParts.length > NO_IMAGE_ATTACHMENTS || lastGeneratedImage !== null
          ? "edit"
          : "generate",
      modelProvider: eveToolModelProvider,
      prompt,
      startMs,
      storeFile,
    },
    selectedModel,
  };
};
const executeImageRequest = async (
  request: Readonly<ImageRequest>
): Promise<GeneratedImageResult> => {
  const { options, selectedModel } = request;
  log.info(
    {
      attachmentCount: options.imageParts.length,
      hasLastGeneratedImage: options.lastGeneratedImage !== null,
      mode: options.mode,
      promptLength: options.prompt.length,
      selectedModel,
    },
    "generateImage: start"
  );
  try {
    const selection = await resolveImageModel(
      options.modelProvider,
      selectedModel
    );
    return selection.multimodal
      ? await runGenerateImageMultimodal(options, selection)
      : await runGenerateImageTraditional(options, selection.modelId);
  } catch (error) {
    const resolvedError = await resolveError(error);
    log.error(
      {
        error: serializeError(resolvedError),
        mode: options.mode,
        ms: Date.now() - options.startMs,
        selectedModel,
        ...getErrorDebugInfo(resolvedError),
      },
      "generateImage: failure"
    );
    throw resolvedError;
  }
};
const runImageRequest = async (
  prompt: string,
  context: Readonly<ImageRequestContext>
): Promise<
  Awaited<ReturnType<typeof executeWithToolUsage<GeneratedImageResult>>>
> =>
  await executeWithToolUsage(
    context,
    async (usage: Readonly<ToolUsage>) =>
      await executeImageRequest(createImageRequest(prompt, context, usage))
  );
export { runImageRequest };
export type { ImageRequestContext };
