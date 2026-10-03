import { generateImage, generateText } from "ai";
import type { FileUIPart } from "ai";
import { defineTool } from "eve/tools";

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import type { ToolModelProvider } from "@/lib/ai/tool-context";
/* oxlint-enable eslint/sort-imports */
import { config } from "@/lib/config";
import { eveGeneratedFileUploader } from "@/lib/eve/generated-files";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { createEveToolCost } from "@/lib/eve/tool-cost";
/* oxlint-enable eslint/sort-imports */
import { eveToolImageContext } from "@/lib/eve/tool-image-context";
import { toolResultToModelOutput } from "@/lib/eve/tool-model-output";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { eveToolModelProvider } from "@/lib/eve/tool-models";
/* oxlint-enable eslint/sort-imports */
import { executeWithToolUsage } from "@/lib/eve/tool-usage";
/* oxlint-disable import/max-dependencies -- This integration composes its explicit adapters here; splitting the imports would hide the dependency boundary without reducing dependencies. */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { downloadFile } from "@/lib/file-storage";
/* oxlint-enable eslint/sort-imports */
/* oxlint-enable import/max-dependencies */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import type { FileUploader } from "@/lib/file-storage";
/* oxlint-enable eslint/sort-imports */
import { keyFromFileUrl } from "@/lib/file-url";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { createModuleLogger } from "@/lib/logger";
/* oxlint-enable eslint/sort-imports */
import { getBaseUrl } from "@/lib/url";

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { generateImageInput } from "./schemas";
/* oxlint-enable eslint/sort-imports */

const log = createModuleLogger("ai.tools.generate-image");

type ImageMode = "edit" | "generate";
/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable jsdoc/require-returns -- The comment documents lifecycle behavior; the TypeScript return contract remains the authoritative result description. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable jsdoc/require-param -- This comment documents the API invariant; parameter names and TypeScript annotations describe the inputs without duplicating them in tags. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
/**
 * Resolve which model to use for image generation and whether it's a
 * multimodal language model (uses generateText) or a dedicated image model
 * (uses generateImage). Uses the dynamic model registry so it works across
 * all gateways, not just the static models.generated snapshot.
 */
const resolveImageModel = async (
  modelProvider: ToolModelProvider,
  selectedModel?: string
): Promise<
  | {
      modelId: string;
      multimodal: true;
      usageModelId: Awaited<
        ReturnType<ToolModelProvider["getModelDefinition"]>
      >["id"];
    }
  | {
      modelId: string;
      multimodal: false;
      usageModelId?: never;
    }
> => {
  // If the user's selected chat model can generate images, prefer it
  if (typeof selectedModel === "string" && selectedModel !== "") {
    try {
      const model = await modelProvider.getModelDefinition(selectedModel);
      if (model.output.image) {
        return {
          modelId: model.apiModelId,
          multimodal: true,
          usageModelId: model.id,
        };
      }
    } catch {
      // Not in app models registry, fall through
    }
  }

  // Fall back to the configured default image model
  const defaultId = config.ai.tools.image.default;
  if (!defaultId) {
    throw new Error(
      "Set ai.tools.image.default to an image model supported by your gateway."
    );
  }
  try {
    const model = await modelProvider.getModelDefinition(defaultId);
    // Default could be a multimodal language model (e.g. gemini-3-pro-image)
    if (model.output.image) {
      return {
        modelId: model.apiModelId,
        multimodal: true,
        usageModelId: model.id,
      };
    }
  } catch {
    // Not in app models registry → dedicated image model (e.g. dall-e-3)
  }

  return { modelId: defaultId, multimodal: false };
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable jsdoc/require-param */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable jsdoc/require-returns */
/* oxlint-enable eslint/max-statements */

const INLINE_IMAGE =
  /^data:image\/(?:png|jpeg|webp|gif);base64,(?<base64>[A-Za-z0-9+/=]+)$/u;

/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
const fetchImageBuffer = async (value: string): Promise<Buffer> => {
  // Inline images do not initiate a network request.
  const inline = INLINE_IMAGE.exec(value);
  if (inline?.groups?.base64) {
    return Buffer.from(inline.groups.base64, "base64");
  }
  const url = new URL(value, getBaseUrl());
  const { origin } = new URL(getBaseUrl());
  const key = keyFromFileUrl(value);
  if (
    url.origin !== origin ||
    url.username ||
    url.password ||
    !(typeof key === "string" && key !== "")
  ) {
    throw new Error(
      "Image editing only accepts uploaded ChatJS files or inline images."
    );
  }
  // Read the configured storage directly. Never follow user-supplied URLs or redirects.
  const file = await downloadFile(key);
  return Buffer.from(await file.arrayBuffer());
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
const collectEditImages = ({
  imageParts,
  lastGeneratedImage,
}: {
  imageParts: FileUIPart[];
  lastGeneratedImage: { imageUrl: string; name: string } | null;
}): Promise<Buffer[]> =>
  Promise.all([
    ...(lastGeneratedImage
      ? [fetchImageBuffer(lastGeneratedImage.imageUrl)]
      : []),
    ...imageParts.map((p) => fetchImageBuffer(p.url)),
  ]);
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/id-length */
/* oxlint-enable eslint/no-ternary */

/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
const serializeError = (
  err: unknown
): {
  name?: string;
  message: string;
  stack?: string;
  raw?: unknown;
} => {
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
      // oxlint-disable-next-line typescript/no-base-to-string -- Diagnostic formatting intentionally accepts arbitrary third-party values; changing their representation requires an error-output contract decision.
      name: e.name ? String(e.name) : undefined,
    };
  }

  return { message: String(err), raw: err };
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable eslint/id-length */

/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
const resolveError = async (error: unknown): Promise<unknown> => {
  if (error && typeof error === "object" && "then" in error) {
    try {
      // oxlint-disable-next-line promise/no-promise-in-callback -- Assimilate an arbitrary SDK thenable so a rejected error promise is caught and inspected below.
      return await Promise.resolve(error);
    } catch (resolvedError) {
      return resolvedError;
    }
  }
  return error;
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
const getErrorDebugInfo = (err: unknown) => ({
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Error inspection accepts arbitrary SDK failure objects; retain optional diagnostic extraction without narrowing the supported error shapes.
  errorConstructor: (err as { constructor?: { name?: string } })?.constructor
    ?.name,
  errorKeys: err && typeof err === "object" ? Object.keys(err) : [],
  errorType: typeof err,
});
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable eslint/init-declarations -- The value is assigned by the following guarded operation; an invented initial value would hide an uninitialized control-flow branch. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const runGenerateImageTraditional = async ({
  mode,
  prompt,
  imageParts,
  lastGeneratedImage,
  startMs,
  costAccumulator,
  abortSignal,
  storeFile,
  modelId,
  modelProvider,
}: {
  mode: ImageMode;
  prompt: string;
  imageParts: FileUIPart[];
  lastGeneratedImage: { imageUrl: string; name: string } | null;
  startMs: number;
  costAccumulator?: ReturnType<typeof createEveToolCost>;
  abortSignal?: AbortSignal;
  storeFile: FileUploader;
  modelId: string;
  modelProvider: ToolModelProvider;
}): Promise<{ fileId: string; imageUrl: string; prompt: string }> => {
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
    abortSignal,
    model: modelProvider.createImageModel(modelId),
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
  // Provider usage is billable even if the subsequent storage upload fails.
  costAccumulator?.addImageCost(
    modelId,
    res.images.length,
    res.usage ?? {},
    "generateImage-traditional"
  );
  const result = await storeFile(filename, buffer, "image/png");

  log.info(
    {
      imageUrl: result.url,
      mode,
      ms: Date.now() - startMs,
      uploadedFilename: filename,
    },
    "generateImage: success"
  );

  return { fileId: result.fileId, imageUrl: result.url, prompt };
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable eslint/id-length */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable eslint/init-declarations */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
/* oxlint-disable oxc/no-rest-spread-properties -- Copying these properties preserves immutable updates and the existing structural API without mutating the source object. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
const runGenerateImageMultimodal = async ({
  modelId,
  usageModelId,
  mode,
  prompt,
  imageParts,
  lastGeneratedImage,
  startMs,
  costAccumulator,
  abortSignal,
  storeFile,
  modelProvider,
}: {
  modelId: string;
  usageModelId: Awaited<
    ReturnType<ToolModelProvider["getModelDefinition"]>
  >["id"];
  mode: ImageMode;
  prompt: string;
  imageParts: FileUIPart[];
  lastGeneratedImage: { imageUrl: string; name: string } | null;
  startMs: number;
  costAccumulator?: ReturnType<typeof createEveToolCost>;
  abortSignal?: AbortSignal;
  storeFile: FileUploader;
  modelProvider: ToolModelProvider;
}): Promise<{ fileId: string; imageUrl: string; prompt: string }> => {
  // Build messages with image context if in edit mode
  interface ImageContent {
    image: Buffer;
    type: "image";
  }
  interface TextContent {
    text: string;
    type: "text";
  }
  const userContent: (TextContent | ImageContent)[] = [];

  if (mode === "edit") {
    for (const image of await collectEditImages({
      imageParts,
      lastGeneratedImage,
    })) {
      userContent.push({ image, type: "image" });
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
    abortSignal,
    messages: [{ content: userContent, role: "user" }],
    model: modelProvider.createLanguageModel(modelId),
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
  const imageFile = res.files?.find((f): boolean =>
    f.mediaType.startsWith("image/")
  );
  if (!imageFile) {
    throw new Error("No image generated by multimodal model");
  }

  log.debug(
    {
      hasBase64: Boolean(imageFile.base64),
      mediaType: imageFile.mediaType,
      mode,
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
      imageUrl: result.url,
      mode,
      modelId,
      ms: Date.now() - startMs,
      uploadedFilename: filename,
    },
    "generateImage: multimodal success"
  );

  return { fileId: result.fileId, imageUrl: result.url, prompt };
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-enable eslint/id-length */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable oxc/no-rest-spread-properties -- Copying these properties preserves immutable updates and the existing structural API without mutating the source object. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
export const generateImageTool = defineTool({
  description: `Generate an image from a user-provided prompt.

The assistant may make small, neutral adjustments to improve clarity, composition, or technical quality, while strictly preserving the user’s original intent, meaning, and message.

The assistant must not add new subjects, claims, branding, or alter the tone or intent of the prompt.
`,
  execute: ({ prompt }, context) =>
    executeWithToolUsage(context, async (usage) => {
      const { abortSignal } = context;
      const costAccumulator = createEveToolCost(usage);
      const modelProvider = eveToolModelProvider;
      const uploadFile = eveGeneratedFileUploader(context);
      // A completed generation followed by a storage failure is an explicit domain result.
      const storeFile: FileUploader = async (...args) => {
        try {
          return await uploadFile(...args);
        } catch {
          return usage.fail();
        }
      };
      const selected = context.session.auth.current?.attributes.modelId;
      const selectedModel = typeof selected === "string" ? selected : undefined;
      const { attachments, lastGeneratedImage } = eveToolImageContext.get();
      const startMs = Date.now();
      const imageParts = attachments.filter(
        (part): boolean =>
          part.type === "file" && part.mediaType?.startsWith("image/")
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
        if (!modelProvider) {
          throw new Error("Image generation requires model provider context.");
        }
        const {
          modelId: effectiveModelId,
          multimodal,
          usageModelId,
        } = await resolveImageModel(modelProvider, selectedModel);

        // Use multimodal path for language models with image generation
        if (multimodal) {
          return await runGenerateImageMultimodal({
            abortSignal,
            costAccumulator,
            imageParts,
            lastGeneratedImage,
            mode,
            modelId: effectiveModelId,
            modelProvider,
            prompt,
            startMs,
            storeFile,
            usageModelId,
          });
        }

        // Traditional image generation for dedicated image models
        return await runGenerateImageTraditional({
          abortSignal,
          costAccumulator,
          imageParts,
          lastGeneratedImage,
          mode,
          modelId: effectiveModelId,
          modelProvider,
          prompt,
          startMs,
          storeFile,
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
    }),
  inputSchema: generateImageInput,
  toModelOutput: toolResultToModelOutput,
});
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable import/no-named-export */
/* oxlint-enable eslint/max-statements */
/* oxlint-enable import/prefer-default-export */

/* oxlint-disable max-lines -- Keep this cohesive contract and its cases together; splitting it solely for a line quota would obscure shared setup or state transitions. */
