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

/** Curated configuration ID for the active gateway. */
type ModelId = GatewayModelIdMap[ActiveGatewayType];

// UI IDs come from a live gateway catalog and persisted selections, including
// reasoning variants and newly published models absent from SDK literal lists.
type AppModelId = string;

type ImageModelId = GatewayImageModelIdMap[ActiveGatewayType];
export type { ActiveGatewayType, AppModelId, ImageModelId, ModelId };
