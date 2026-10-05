import { eveGeneratedFileUploader } from "@/lib/eve/generated-files";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { createEveToolCost } from "@/lib/eve/tool-cost";
/* oxlint-enable sort-imports */
import { eveToolImageContext } from "@/lib/eve/tool-image-context";
import { eveToolModelProvider } from "@/lib/eve/tool-models";
import { executeWithToolUsage } from "@/lib/eve/tool-usage";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ToolUsage } from "@/lib/eve/tool-usage";
/* oxlint-enable sort-imports */
import { createModuleLogger } from "@/lib/logger";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  ABSENT_DIAGNOSTIC_VALUE,
  getErrorDebugInfo,
  resolveError,
  serializeError,
} from "./image-errors";
/* oxlint-enable sort-imports */
import type {
  GeneratedImageResult,
  ImageGenerationOptions,
  ImageStoreFile,
} from "./image-generation";
import {
  runGenerateImageMultimodal,
  runGenerateImageTraditional,
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
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve storeFile's awaited sequencing and rejected-Promise behavior. */
  // A provider generation followed by storage failure is an explicit domain result.
  const storeFile: ImageStoreFile = async (filename, body, mediaType) => {
    try {
      return await uploadFile(filename, body, mediaType);
    } catch {
      return usage.fail();
    }
  };
  /* oxlint-enable oxc/no-async-await */
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading attributes from context.session.auth.current; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
  const selected = context.session.auth.current?.attributes.modelId;
  const selectedModel =
    typeof selected === "string" ? selected : ABSENT_DIAGNOSTIC_VALUE;
  const { attachments, lastGeneratedImage } = eveToolImageContext.get();
  const startMs = Date.now();
  const imageParts = attachments.filter(
    (part: Readonly<{ type: string; mediaType?: string }>): boolean =>
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading startsWith from part.mediaType; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
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
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve executeImageRequest's awaited sequencing and rejected-Promise behavior. */
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

    if (selection.multimodal) {
      return await runGenerateImageMultimodal(options, selection);
    }
    return await runGenerateImageTraditional(options, selection.modelId);
  } catch (error) {
    const resolvedError = await resolveError(error);
    log.error(
      {
        error: serializeError(resolvedError),
        mode: options.mode,
        ms: Date.now() - options.startMs,
        selectedModel,
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing getErrorDebugInfo(resolvedError) own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...getErrorDebugInfo(resolvedError),
      },
      "generateImage: failure"
    );
    throw resolvedError;
  }
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve runImageRequest's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (runImageRequest); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable oxc/no-async-await */
export { runImageRequest };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (ImageRequestContext); the enabled import/no-default-export convention rejects the default-export alternative. */
export type { ImageRequestContext };
/* oxlint-enable import/no-named-export */
