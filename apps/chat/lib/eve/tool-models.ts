/* oxlint-disable sort-imports -- Preserve runtime import evaluation order and pinned Oxfmt type/binding grouping; native alphabetical ordering conflicts with that grouping. */
import { getActiveGateway } from "@/lib/ai/active-gateway";
import type { InstalledGateway } from "@/lib/ai/gateways/registry";
import type { ToolModelProvider } from "@/lib/ai/tool-context";

import { loadEveModelDefinition } from "./model-selection";
/* oxlint-enable sort-imports */

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (eveToolModelProvider); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve eveToolModelProvider's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): eveToolModelProvider uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
export const eveToolModelProvider: ToolModelProvider = {
  createImageModel: (modelId) => {
    const gateway = getActiveGateway();
    const model = gateway.createImageModel(
      // oxlint-disable-next-line typescript/no-unnecessary-type-assertion, typescript/no-unsafe-type-assertion -- OpenAI's generated scaffold requires OpenaiImageModelId, while EVE supplies a runtime string. packages/cli test:gateways fails type-checking here without this cast.
      modelId as Parameters<InstalledGateway["createImageModel"]>[0]
    );
    if (model === null) {
      throw new Error(
        `Gateway '${gateway.type}' does not support dedicated image models. Use a multimodal language model instead.`
      );
    }
    return model;
  },
  createLanguageModel: (modelId) =>
    getActiveGateway().createLanguageModel(modelId),
  createVideoModel: (modelId) => {
    const gateway = getActiveGateway();
    const model = gateway.createVideoModel(
      // oxlint-disable-next-line typescript/no-unnecessary-type-assertion, typescript/no-unsafe-type-assertion -- OpenAI-compatible's generated scaffold types unsupported video IDs as never, while EVE supplies a runtime string. packages/cli test:gateways fails type-checking here without this cast.
      modelId as Parameters<InstalledGateway["createVideoModel"]>[0]
    );
    if (model === null) {
      throw new Error(
        `Gateway '${gateway.type}' does not support video models.`
      );
    }
    return model;
  },
  getModelDefinition: async (modelId) => {
    const model = await loadEveModelDefinition(modelId);
    return {
      apiModelId: model.apiModelId,
      // The EVE catalog and active gateway validate the runtime ID at this boundary.
      id: model.id,
      output: model.output,
    };
  },
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-magic-numbers */
