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
  return fallback.multimodal
    ? fallback
    : { modelId: defaultId, multimodal: false };
};
export { resolveImageModel };
export type { ImageModelSelection };
