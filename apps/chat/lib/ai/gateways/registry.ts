import type { GatewayProvider as GatewayProviderBase } from "@chat-js/gateways/gateway-provider";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { Gateway } from "@/lib/ai/gateway";
/* oxlint-enable sort-imports */
import type { gatewayType } from "@/lib/ai/gateway-model-defaults";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { generatedForGateway, models } from "@/lib/ai/models.generated";
/* oxlint-enable sort-imports */

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

type GatewayModelIdMap = Record<
  GatewayType,
  Parameters<
    InstalledGateway["createLanguageModel"]
  >[typeof MODEL_ID_PARAMETER_INDEX]
>;

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
    | Parameters<
        InstalledGateway["createImageModel"]
      >[typeof MODEL_ID_PARAMETER_INDEX]
    | (SelectedGateway extends typeof generatedForGateway
        ? MultimodalImageModel
        : never);
};

type GatewayVideoModelIdMap = Record<
  GatewayType,
  Parameters<
    InstalledGateway["createVideoModel"]
  >[typeof MODEL_ID_PARAMETER_INDEX]
>;
export type {
  GatewayImageModelIdMap,
  GatewayModelIdMap,
  GatewayProvider,
  GatewayType,
  GatewayVideoModelIdMap,
  InstalledGateway,
};
