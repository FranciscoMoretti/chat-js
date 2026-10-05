import type chatConfig from "@/chat.config";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type {
  GatewayImageModelIdMap,
  GatewayModelIdMap,
  GatewayType,
} from "./gateways/registry";
/* oxlint-enable sort-imports */

/** The gateway type actively selected in chat.config.ts */
type ActiveGatewayType = typeof chatConfig extends {
  ai: { gateway: infer ConfiguredGateway extends GatewayType };
}
  ? ConfiguredGateway
  : GatewayType;

/** Runtime model ID — narrowed to the active gateway */
type ModelId = GatewayModelIdMap[ActiveGatewayType];

/** App-level model ID (same as ModelId; autocomplete comes from ConfigInput) */
type AppModelId = ModelId;

type ImageModelId = GatewayImageModelIdMap[ActiveGatewayType];
export type { ActiveGatewayType, AppModelId, ImageModelId, ModelId };
