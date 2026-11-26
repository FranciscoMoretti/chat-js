import type { createGateway } from "@/integrations/providers/gateway";
import type { GatewayProvider as GatewayProviderBase } from "@/chatjs/core/gateway/gateway-provider";
import type {
  ConfigMediaModelId,
  StrictLiterals,
} from "@/chatjs/core/gateway/provider-types";
import type { gatewayType } from "@/chatjs/providers/gateway-defaults";

type InstalledGateway = ReturnType<typeof createGateway>;

type GatewayType = typeof gatewayType;

const MODEL_ID_PARAMETER_INDEX = 0;

type GatewayProvider = GatewayProviderBase<GatewayType>;

// Runtime SDK factories accept new provider IDs. Configuration keeps curated
// literal suggestions where the SDK supplies them; open adapters keep strings.
type RuntimeLanguageModelId = Parameters<
  InstalledGateway["createLanguageModel"]
>[typeof MODEL_ID_PARAMETER_INDEX];
type ConfigLanguageModelId = [StrictLiterals<RuntimeLanguageModelId>] extends [
  never,
]
  ? RuntimeLanguageModelId
  : StrictLiterals<RuntimeLanguageModelId>;
type GatewayModelIdMap = Record<GatewayType, ConfigLanguageModelId>;

type GatewayImageModelIdMap = Record<
  GatewayType,
  ConfigMediaModelId<InstalledGateway["createImageModel"]>
>;

type GatewayVideoModelIdMap = Record<
  GatewayType,
  ConfigMediaModelId<InstalledGateway["createVideoModel"]>
>;
export type {
  GatewayImageModelIdMap,
  GatewayModelIdMap,
  GatewayProvider,
  GatewayType,
  GatewayVideoModelIdMap,
};
