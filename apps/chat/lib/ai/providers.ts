import { devToolsMiddleware } from "@ai-sdk/devtools";
import type {
  Experimental_VideoModelV4,
  LanguageModelV4,
  SharedV4ProviderOptions,
} from "@ai-sdk/provider";
import { getModelProviderOptions as modelProviderOptions } from "@chat-js/gateways/provider-options";
import { extractReasoningMiddleware, wrapLanguageModel } from "ai";
import type { ImageModel, LanguageModelMiddleware } from "ai";

import { getActiveGateway } from "./active-gateway";
import type { AppModelId } from "./app-models";
import { getAppModelDefinition } from "./app-models";
import type { InstalledGateway } from "./gateways/registry";

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): ActiveGatewayImageModelId uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
type ActiveGatewayImageModelId = Parameters<
  InstalledGateway["createImageModel"]
>[0];
/* oxlint-enable no-magic-numbers */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): ActiveGatewayVideoModelId uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
type ActiveGatewayVideoModelId = Parameters<
  InstalledGateway["createVideoModel"]
>[0];
/* oxlint-enable no-magic-numbers */

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
/* oxlint-enable no-magic-numbers, node/no-process-env */

/* oxlint-disable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
typescript/prefer-readonly-parameter-types (#565): getImageModel accepts modelId: ActiveGatewayImageModelId; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): getImageModel intentionally keeps the existing falsy-value behavior of imageModel; distinguishing empty, zero, and absent states requires a domain behavior decision.  */
const getImageModel = (modelId: ActiveGatewayImageModelId): ImageModel => {
  const imageModel = getActiveGateway().createImageModel(modelId);
  if (!imageModel) {
    throw new Error(
      `Gateway '${getActiveGateway().type}' does not support dedicated image models. Use a multimodal language model instead.`
    );
  }
  return imageModel;
};
/* oxlint-enable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable typescript/prefer-readonly-parameter-types --
typescript/prefer-readonly-parameter-types (#565): getVideoModel accepts modelId: ActiveGatewayVideoModelId; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.  */
const getVideoModel = (
  modelId: ActiveGatewayVideoModelId
): Experimental_VideoModelV4 => {
  const videoModel = getActiveGateway().createVideoModel(modelId);
  if (!videoModel) {
    throw new Error(
      `Gateway '${getActiveGateway().type}' does not support video models.`
    );
  }
  return videoModel;
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */

// Get a multimodal language model that can generate images via generateText
const getMultimodalImageModel = (modelId: string): LanguageModelV4 =>
  getActiveGateway().createLanguageModel(modelId);

// Model aliases removed - use getLanguageModel directly with specific model IDs

const getModelProviderOptions = async (
  providerModelId: AppModelId
): Promise<SharedV4ProviderOptions> =>
  modelProviderOptions(await getAppModelDefinition(providerModelId));

export {
  getImageModel,
  getLanguageModel,
  getModelProviderOptions,
  getMultimodalImageModel,
  getVideoModel,
};
