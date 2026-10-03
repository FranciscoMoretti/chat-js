import type chatConfig from "@/chat.config";

import type {
  GatewayImageModelIdMap,
  GatewayModelIdMap,
  GatewayType,
} from "./gateways/registry";

/* oxlint-disable id-length, import/group-exports  --
 * id-length (#506): ActiveGatewayType uses G as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * import/group-exports (#523): ActiveGatewayType stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named ActiveGatewayType API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
/** The gateway type actively selected in chat.config.ts */
export type ActiveGatewayType = typeof chatConfig extends {
  ai: { gateway: infer G extends GatewayType };
}
  ? G
  : GatewayType;
/* oxlint-enable id-length, import/group-exports */

/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): ModelId stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named ModelId API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
/** Runtime model ID — narrowed to the active gateway */
export type ModelId = GatewayModelIdMap[ActiveGatewayType];
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): AppModelId stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named AppModelId API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
/** App-level model ID (same as ModelId; autocomplete comes from ConfigInput) */
export type AppModelId = ModelId;
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): ImageModelId stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named ImageModelId API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type ImageModelId = GatewayImageModelIdMap[ActiveGatewayType];
/* oxlint-enable import/group-exports */
