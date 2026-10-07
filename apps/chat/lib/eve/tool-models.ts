import { getActiveGateway } from "@/lib/ai/active-gateway";
import type { InstalledGateway } from "@/lib/ai/gateways/registry";
import type { ToolModelProvider } from "@/lib/ai/tool-context";

import { loadEveModelDefinition } from "./model-selection";

/* oxlint-disable no-magic-numbers, typescript/strict-boolean-expressions --
 * no-magic-numbers (#517): eveToolModelProvider uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/strict-boolean-expressions (#610): eveToolModelProvider intentionally keeps the existing falsy-value behavior of model; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
export const eveToolModelProvider: ToolModelProvider = {
  createImageModel: (modelId) => {
    const gateway = getActiveGateway();
    const model = gateway.createImageModel(
      // oxlint-disable-next-line typescript/no-unnecessary-type-assertion, typescript/no-unsafe-type-assertion -- #781: Generated adapters use never for unsupported media and return null without consuming the ID; supported adapters keep SDK model-ID inputs. This dynamic ToolModelProvider bridge must preserve both contracts; the null guard reports unsupported media.
      modelId as Parameters<InstalledGateway["createImageModel"]>[0]
    );
    if (!model) {
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
      // oxlint-disable-next-line typescript/no-unnecessary-type-assertion, typescript/no-unsafe-type-assertion -- #781: Generated adapters use never for unsupported media and return null without consuming the ID; supported adapters keep SDK model-ID inputs. This dynamic ToolModelProvider bridge must preserve both contracts; the null guard reports unsupported media.
      modelId as Parameters<InstalledGateway["createVideoModel"]>[0]
    );
    if (!model) {
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
/* oxlint-enable no-magic-numbers, typescript/strict-boolean-expressions */
