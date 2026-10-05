import type { ToolModelProvider } from "@/lib/ai/tool-context";
import { config } from "@/lib/config";

type ImageModelSelection =
  | {
      modelId: string;
      multimodal: true;
      usageModelId: Awaited<
        ReturnType<ToolModelProvider["getModelDefinition"]>
      >["id"];
    }
  | { modelId: string; multimodal: false; usageModelId?: never };
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve findMultimodalModel's awaited sequencing and rejected-Promise behavior. */
const findMultimodalModel = async (
  provider: Readonly<ToolModelProvider>,
  modelId: unknown
): Promise<
  Extract<ImageModelSelection, { multimodal: true }> | { multimodal: false }
> => {
  if (typeof modelId !== "string" || modelId === "") {
    return { multimodal: false };
  }
  try {
    const model = await provider.getModelDefinition(modelId);
    if (model.output.image) {
      return {
        modelId: model.apiModelId,
        multimodal: true,
        usageModelId: model.id,
      };
    }
  } catch {
    /* A model absent from the dynamic registry may be a dedicated image model. */
  }
  return { multimodal: false };
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve resolveImageModel's awaited sequencing and rejected-Promise behavior. */
const resolveImageModel = async (
  provider: Readonly<ToolModelProvider>,
  selectedModel: unknown
): Promise<ImageModelSelection> => {
  const selected = await findMultimodalModel(provider, selectedModel);
  if (selected.multimodal) {
    return selected;
  }
  const defaultId = config.ai.tools.image.default;
  if (typeof defaultId !== "string" || defaultId === "") {
    throw new Error(
      "Set ai.tools.image.default to an image model supported by your gateway."
    );
  }
  const fallback = await findMultimodalModel(provider, defaultId);

  if (fallback.multimodal) {
    return fallback;
  }
  return { modelId: defaultId, multimodal: false };
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (resolveImageModel); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable oxc/no-async-await */
export { resolveImageModel };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (ImageModelSelection); the enabled import/no-default-export convention rejects the default-export alternative. */
export type { ImageModelSelection };
/* oxlint-enable import/no-named-export */
