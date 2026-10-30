import type { generatedForGateway, models } from "@/lib/ai/models.generated";
import type { createGateway } from "@/integrations/gateway";
import type { GatewayProvider as GatewayProviderBase } from "@chat-js/gateways/gateway-provider";
import type {
  ConfigMediaModelId,
  StrictLiterals,
} from "@chat-js/gateways/provider-types";
import type { gatewayType } from "@/lib/ai/gateway-model-defaults";

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

// Helper: check whether a model tag tuple contains the requested tag.
type TupleIncludes<
  Tags extends readonly unknown[],
  Tag,
> = Tags extends readonly [infer FirstTag, ...infer RemainingTags]
  ? FirstTag extends Tag
    ? true
    : TupleIncludes<RemainingTags, Tag>
  : false;

// Extract language models with "image-generation" tag from the snapshot
type MultimodalImageModel =
  Extract<
    (typeof models)[number],
    { type: "language"; tags: readonly string[] }
  > extends infer Model
    ? Model extends { id: infer Id; tags: infer Tags extends readonly string[] }
      ? TupleIncludes<Tags, "image-generation"> extends true
        ? Id
        : never
      : never
    : never;

type GatewayImageModelIdMap = {
  [SelectedGateway in GatewayType]:
    | ConfigMediaModelId<InstalledGateway["createImageModel"]>
    | (SelectedGateway extends typeof generatedForGateway
        ? MultimodalImageModel
        : never);
};

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
