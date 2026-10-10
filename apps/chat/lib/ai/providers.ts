import type { ImageModel, LanguageModelMiddleware } from "ai";
import type {
  LanguageModelV4,
  SharedV4ProviderOptions,
} from "@ai-sdk/provider";
import { extractReasoningMiddleware, wrapLanguageModel } from "ai";
import type { AppModelId } from "./app-models";
import type { InstalledGateway } from "./gateways/registry";

import { devToolsMiddleware } from "@ai-sdk/devtools";
import { getActiveGateway } from "./active-gateway";
import { getAppModelDefinition } from "./app-models";
import { getModelProviderOptions as modelProviderOptions } from "@chat-js/gateways/provider-options";

type ActiveGatewayImageModelId = Parameters<
  InstalledGateway["createImageModel"]
  // oxlint-disable-next-line eslint/no-magic-numbers -- Zero selects the existing first tuple/SDK middleware parameter in this type-only contract; it is not a runtime domain constant.
>[0];

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getLanguageModel's awaited sequencing and rejected-Promise behavior. */

/* oxlint-disable no-magic-numbers, node/no-process-env --
 no-magic-numbers (#517): getLanguageModel uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
node/no-process-env (#537): getLanguageModel reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior. */
const getLanguageModel = async (
  modelId: AppModelId
): Promise<LanguageModelV4> => {
  const model = await getAppModelDefinition(modelId);
  const languageProvider = getActiveGateway().createLanguageModel(
    model.apiModelId
  );

  const middlewares: LanguageModelMiddleware[] = [];

  // Add devtools middleware in development
  if (process.env.NODE_ENV === "development") {
    middlewares.push(devToolsMiddleware());
  }

  // Add reasoning middleware if the model supports reasoning
  if (model.reasoning && model.owned_by === "xai") {
    middlewares.push(extractReasoningMiddleware({ tagName: "think" }));
  }

  if (middlewares.length === 0) {
    return languageProvider;
  }

  return wrapLanguageModel({
    middleware: middlewares,
    model: languageProvider,
  });
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-magic-numbers, node/no-process-env */

const getImageModel = (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Forward the exact installed gateway model-ID contract, including SDK literal suggestions and open string intersections. The faithful primitive-preserving readonly projection retains this scalar alias and the pinned rule finding.
  modelId: ActiveGatewayImageModelId
): ImageModel => {
  const imageModel = getActiveGateway().createImageModel(modelId);
  if (imageModel === null) {
    throw new Error(
      `Gateway '${getActiveGateway().type}' does not support dedicated image models. Use a multimodal language model instead.`
    );
  }
  return imageModel;
};
// Get a multimodal language model that can generate images via generateText
const getMultimodalImageModel = (modelId: string): LanguageModelV4 =>
  getActiveGateway().createLanguageModel(modelId);

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getModelProviderOptions's awaited sequencing and rejected-Promise behavior. */
// Model aliases removed - use getLanguageModel directly with specific model IDs

const getModelProviderOptions = async (
  providerModelId: AppModelId
): Promise<SharedV4ProviderOptions> =>
  modelProviderOptions(await getAppModelDefinition(providerModelId));
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (getImageModel, getLanguageModel, getModelProviderOptions, getMultimodalImageModel); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
export {
  getImageModel,
  getLanguageModel,
  getModelProviderOptions,
  getMultimodalImageModel,
};
/* oxlint-enable import/no-named-export */
