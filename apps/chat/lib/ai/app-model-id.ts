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

/** Curated configuration ID for the active gateway. */
type ModelId = GatewayModelIdMap[ActiveGatewayType];

// UI IDs come from a live gateway catalog and persisted selections, including
// reasoning variants and newly published models absent from SDK literal lists.
type AppModelId = string;

type ImageModelId = GatewayImageModelIdMap[ActiveGatewayType];
/* oxlint-disable import/no-named-export -- Keep the named type bindings (ActiveGatewayType, AppModelId, ImageModelId, ModelId); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { ActiveGatewayType, AppModelId, ImageModelId, ModelId };
/* oxlint-enable import/no-named-export */
