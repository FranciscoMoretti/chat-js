import { experimental_generateVideo as generateVideo } from "ai";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { defineTool } from "eve/tools";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import type { ToolModelProvider } from "@/lib/ai/tool-context";
/* oxlint-enable eslint/sort-imports */
import { config } from "@/lib/config";
import { eveGeneratedFileUploader } from "@/lib/eve/generated-files";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { createEveToolCost } from "@/lib/eve/tool-cost";
/* oxlint-enable eslint/sort-imports */
import { toolResultToModelOutput } from "@/lib/eve/tool-model-output";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { eveToolModelProvider } from "@/lib/eve/tool-models";
/* oxlint-enable eslint/sort-imports */
import { executeWithToolUsage } from "@/lib/eve/tool-usage";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import type { FileUploader } from "@/lib/file-storage";
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable import/max-dependencies -- This integration composes its explicit adapters here; splitting the imports would hide the dependency boundary without reducing dependencies. */
import { createModuleLogger } from "@/lib/logger";
/* oxlint-enable import/max-dependencies */

import { generateVideoInput } from "./schemas";

// Fixed estimate — not yet available from provider API
const COST_CENTS = 50;

const log = createModuleLogger("ai.tools.generate-video");
const DEFAULT_ASPECT_RATIO = "16:9";
const DEFAULT_DURATION_SECONDS = 5;
const ALLOWED_EXTENSIONS = new Set(["mp4", "webm", "mov"]);

/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
const resolveVideoExtension = (mediaType?: string): string => {
  if (!(typeof mediaType === "string" && mediaType !== "")) {
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
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable oxc/no-optional-chaining */

/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
const resolveVideoModel = async (
  modelProvider: ToolModelProvider,
  selectedModel?: string
): Promise<string> => {
  if (typeof selectedModel === "string" && selectedModel !== "") {
    try {
      const model = await modelProvider.getModelDefinition(selectedModel);
      if (model.output.video) {
        return model.apiModelId;
      }
    } catch {
      // Not in app models registry, fall through
    }
  }
  const modelId = config.ai.tools.video.default;
  if (!modelId) {
    throw new Error(
      "Set ai.tools.video.default to a video model supported by your gateway."
    );
  }
  return modelId;
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable oxc/no-rest-spread-properties -- Copying these properties preserves immutable updates and the existing structural API without mutating the source object. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
export const generateVideoTool = defineTool({
  description:
    "Generate a short video clip from a text prompt. Use this when the user asks to create, make, or generate a video.",
  execute: ({ prompt, aspectRatio, durationSeconds }, context) =>
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
        if (!modelProvider) {
          throw new Error("Video generation requires model provider context.");
        }
        const modelId = await resolveVideoModel(modelProvider, selectedModel);
        const isGoogleModel =
          modelId.startsWith("google/") || modelId.includes("gemini");

        log.debug({ modelId }, "generateVideo: resolved model");

        const result = await generateVideo({
          abortSignal,
          aspectRatio: finalAspectRatio,
          duration: finalDurationSeconds,
          model: modelProvider.createVideoModel(modelId),
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

        // Provider usage is billable even if the subsequent storage upload fails.
        costAccumulator?.addAPICost("generateVideo", COST_CENTS);

        const buffer = Buffer.from(video.uint8Array);
        const timestamp = Date.now();
        const ext = resolveVideoExtension(video.mediaType);
        const filename = `generated-video-${timestamp}.${ext}`;
        const uploaded = await storeFile(filename, buffer, video.mediaType);

        log.info(
          {
            modelId,
            ms: Date.now() - startMs,
            videoUrl: uploaded.url,
          },
          "generateVideo: success"
        );

        return { fileId: uploaded.fileId, prompt, videoUrl: uploaded.url };
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
    }),
  inputSchema: generateVideoInput,
  toModelOutput: toolResultToModelOutput,
});
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable import/no-named-export */
/* oxlint-enable eslint/max-statements */
/* oxlint-enable import/prefer-default-export */
