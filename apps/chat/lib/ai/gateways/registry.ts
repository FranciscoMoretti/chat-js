/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../gateway"; "../gateway-model-defaults"; "../models.generated" dependency within this package instead of introducing an alias or barrel API.
 */
import type { GatewayProvider as GatewayProviderBase } from "@chat-js/gateways/gateway-provider";
import type { StrictLiterals } from "@chat-js/gateways/provider-types";

import type { Gateway } from "../gateway";
import type { gatewayType } from "../gateway-model-defaults";
import type { generatedForGateway, models } from "../models.generated";
/* oxlint-enable import/no-relative-parent-imports */

type InstalledGateway = InstanceType<typeof Gateway>;

type GatewayType = typeof gatewayType;

const MODEL_ID_PARAMETER_INDEX = 0;

// Derive the installed adapter's parameter types before applying its selected
// gateway type. Unsupported factories keep never, and provider-specific IDs
// remain narrow even when the reference gateway currently accepts strings.
type InstalledProviderContract<
  Provider extends GatewayProviderBase<string, never, never, never>,
  SelectedType extends string,
> = GatewayProviderBase<
  SelectedType,
  Parameters<Provider["createLanguageModel"]>[typeof MODEL_ID_PARAMETER_INDEX],
  Parameters<Provider["createImageModel"]>[typeof MODEL_ID_PARAMETER_INDEX],
  Parameters<Provider["createVideoModel"]>[typeof MODEL_ID_PARAMETER_INDEX]
>;

type GatewayProvider = InstalledProviderContract<InstalledGateway, GatewayType>;

/* oxlint-disable no-magic-numbers -- moving it below executable initialization can obscure ordering and API ownership.
no-magic-numbers (#517): GatewayModelIdMap uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions. */
// Runtime SDK factories accept new provider IDs. Configuration keeps curated
// literal suggestions where the SDK supplies them; open adapters keep strings.
type RuntimeLanguageModelId = Parameters<
  InstalledGateway["createLanguageModel"]
>[0];
type ConfigLanguageModelId = [StrictLiterals<RuntimeLanguageModelId>] extends [
  never,
]
  ? RuntimeLanguageModelId
  : StrictLiterals<RuntimeLanguageModelId>;
type GatewayModelIdMap = Record<GatewayType, ConfigLanguageModelId>;
/* oxlint-enable no-magic-numbers */

/* oxlint-disable id-length --
 * id-length (#506): TupleIncludes uses T; E; H; R as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 */
// Helper: check if tuple T contains element E
type TupleIncludes<T extends readonly unknown[], E> = T extends readonly [
  infer H,
  ...infer R,
]
  ? H extends E
    ? true
    : TupleIncludes<R, E>
  : false;
/* oxlint-enable id-length */

/* oxlint-disable id-length --
 * id-length (#506): MultimodalImageModel uses M as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 */
// Extract language models with "image-generation" tag from the snapshot
type MultimodalImageModel =
  Extract<
    (typeof models)[number],
    { type: "language"; tags: readonly string[] }
  > extends infer M
    ? M extends { id: infer Id; tags: infer Tags extends readonly string[] }
      ? TupleIncludes<Tags, "image-generation"> extends true
        ? Id
        : never
      : never
    : never;
/* oxlint-enable id-length */

/* oxlint-disable id-length, no-magic-numbers -- id-length (#506): GatewayImageModelIdMap uses K as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
no-magic-numbers (#517): GatewayImageModelIdMap uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions. */
type GatewayImageModelIdMap = {
  [K in GatewayType]:
    | Parameters<InstalledGateway["createImageModel"]>[0]
    | (K extends typeof generatedForGateway ? MultimodalImageModel : never);
};
/* oxlint-enable id-length, no-magic-numbers */

/* oxlint-disable no-magic-numbers -- no-magic-numbers (#517): GatewayVideoModelIdMap uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions. */
type GatewayVideoModelIdMap = Record<
  GatewayType,
  Parameters<InstalledGateway["createVideoModel"]>[0]
>;
/* oxlint-enable no-magic-numbers */
export type {
  GatewayImageModelIdMap,
  GatewayModelIdMap,
  GatewayProvider,
  GatewayType,
  GatewayVideoModelIdMap,
  InstalledGateway,
};
