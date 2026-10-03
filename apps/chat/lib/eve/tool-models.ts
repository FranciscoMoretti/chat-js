/* oxlint-disable import/no-relative-parent-imports, sort-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../ai/active-gateway"; "../ai/app-model-id"; "../ai/gateways/registry"; "../ai/tool-context" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { getActiveGateway } from "../ai/active-gateway";
import type { AppModelId } from "../ai/app-model-id";
import type { InstalledGateway } from "../ai/gateways/registry";
import type { ToolModelProvider } from "../ai/tool-context";
import { loadEveModelDefinition } from "./model-selection";
/* oxlint-enable import/no-relative-parent-imports, sort-imports */

/* oxlint-disable import/no-named-export, import/prefer-default-export, no-magic-numbers, oxc/no-async-await, typescript/strict-boolean-expressions --
 * import/no-named-export (#527): Preserve the named eveToolModelProvider API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): eveToolModelProvider remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * no-magic-numbers (#517): eveToolModelProvider uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): eveToolModelProvider sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/strict-boolean-expressions (#610): eveToolModelProvider intentionally keeps the existing falsy-value behavior of model; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
export const eveToolModelProvider: ToolModelProvider = {
  createImageModel: (modelId) => {
    const gateway = getActiveGateway();
    const model = gateway.createImageModel(
      // oxlint-disable-next-line typescript/no-unnecessary-type-assertion, typescript/no-unsafe-type-assertion -- #591, #599: Scaffolding replaces InstalledGateway with provider-specific IDs (or never for unsupported media); preserve that generated contract while the null result below handles unsupported models.
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
    getActiveGateway().createLanguageModel(
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: The installed gateway owns the model-ID contract; encoding it across the dynamic gateway registry requires a coordinated type migration.
      modelId as Parameters<InstalledGateway["createLanguageModel"]>[0]
    ),
  createVideoModel: (modelId) => {
    const gateway = getActiveGateway();
    const model = gateway.createVideoModel(
      // oxlint-disable-next-line typescript/no-unnecessary-type-assertion, typescript/no-unsafe-type-assertion -- #591, #599: Scaffolding replaces InstalledGateway with provider-specific IDs (or never for unsupported media); preserve that generated contract while the null result below handles unsupported models.
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
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: The installed gateway owns the model-ID contract; encoding it across the dynamic gateway registry requires a coordinated type migration.
      id: model.id as AppModelId,
      output: model.output,
    };
  },
};
/* oxlint-enable import/no-named-export, import/prefer-default-export, no-magic-numbers, oxc/no-async-await, typescript/strict-boolean-expressions */
