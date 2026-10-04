import type chatConfig from "@/chat.config";

import type {
  GatewayImageModelIdMap,
  GatewayModelIdMap,
  GatewayType,
} from "./gateways/registry";

/* oxlint-disable id-length -- id-length (#506): ActiveGatewayType uses G as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology. */
/** The gateway type actively selected in chat.config.ts */
type ActiveGatewayType = typeof chatConfig extends {
  ai: { gateway: infer G extends GatewayType };
}
  ? G
  : GatewayType;
/* oxlint-enable id-length */

/** Runtime model ID — narrowed to the active gateway */
type ModelId = GatewayModelIdMap[ActiveGatewayType];

/** App-level model ID (same as ModelId; autocomplete comes from ConfigInput) */
type AppModelId = ModelId;

type ImageModelId = GatewayImageModelIdMap[ActiveGatewayType];
export type { ActiveGatewayType, AppModelId, ImageModelId, ModelId };
