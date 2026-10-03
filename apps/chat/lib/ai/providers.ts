/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { devToolsMiddleware } from "@ai-sdk/devtools";
import { getModelProviderOptions as modelProviderOptions } from "@chat-js/gateways/provider-options";
import { extractReasoningMiddleware, wrapLanguageModel } from "ai";
import type { LanguageModelMiddleware } from "ai";

import { getActiveGateway } from "./active-gateway";
import type { AppModelId } from "./app-models";
import { getAppModelDefinition } from "./app-models";
import type { InstalledGateway } from "./gateways/registry";
/* oxlint-enable sort-imports */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): ActiveGatewayModelId uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
type ActiveGatewayModelId = Parameters<
  InstalledGateway["createLanguageModel"]
>[0];
/* oxlint-enable no-magic-numbers */
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

/* oxlint-disable import/group-exports, import/no-named-export, no-magic-numbers, node/no-process-env, oxc/no-async-await, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types --
 * import/group-exports (#523): getLanguageModel stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named getLanguageModel API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): getLanguageModel uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * node/no-process-env (#537): getLanguageModel reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 * oxc/no-async-await (#540): getLanguageModel sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep getLanguageModel's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep getLanguageModel's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
export const getLanguageModel = async (modelId: AppModelId) => {
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
/* oxlint-enable import/group-exports, import/no-named-export, no-magic-numbers, node/no-process-env, oxc/no-async-await, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */

/* oxlint-disable import/group-exports, import/no-named-export, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * import/group-exports (#523): getImageModel stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named getImageModel API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/explicit-function-return-type (#560): Keep getImageModel's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep getImageModel's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): getImageModel accepts modelId: ActiveGatewayImageModelId; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): getImageModel intentionally keeps the existing falsy-value behavior of imageModel; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
export const getImageModel = (modelId: ActiveGatewayImageModelId) => {
  const imageModel = getActiveGateway().createImageModel(modelId);
  if (!imageModel) {
    throw new Error(
      `Gateway '${getActiveGateway().type}' does not support dedicated image models. Use a multimodal language model instead.`
    );
  }
  return imageModel;
};
/* oxlint-enable import/group-exports, import/no-named-export, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable import/group-exports, import/no-named-export, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types --
 * import/group-exports (#523): getVideoModel stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named getVideoModel API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/explicit-function-return-type (#560): Keep getVideoModel's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep getVideoModel's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): getVideoModel accepts modelId: ActiveGatewayVideoModelId; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const getVideoModel = (modelId: ActiveGatewayVideoModelId) => {
  const videoModel = getActiveGateway().createVideoModel(modelId);
  if (!videoModel) {
    throw new Error(
      `Gateway '${getActiveGateway().type}' does not support video models.`
    );
  }
  return videoModel;
};
/* oxlint-enable import/group-exports, import/no-named-export, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, import/no-named-export, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types --
 * import/group-exports (#523): getMultimodalImageModel stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named getMultimodalImageModel API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/explicit-function-return-type (#560): Keep getMultimodalImageModel's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep getMultimodalImageModel's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
// Get a multimodal language model that can generate images via generateText
export const getMultimodalImageModel = (modelId: ActiveGatewayModelId) =>
  getActiveGateway().createLanguageModel(modelId);
/* oxlint-enable import/group-exports, import/no-named-export, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */

/* oxlint-disable import/group-exports, import/no-named-export, oxc/no-async-await, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types --
 * import/group-exports (#523): getModelProviderOptions stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named getModelProviderOptions API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * oxc/no-async-await (#540): getModelProviderOptions sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep getModelProviderOptions's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep getModelProviderOptions's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
// Model aliases removed - use getLanguageModel directly with specific model IDs

export const getModelProviderOptions = async (providerModelId: AppModelId) =>
  modelProviderOptions(await getAppModelDefinition(providerModelId));
/* oxlint-enable import/group-exports, import/no-named-export, oxc/no-async-await, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
