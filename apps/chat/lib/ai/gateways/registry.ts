import type { GatewayProvider as GatewayProviderBase } from "@chat-js/gateways/gateway-provider";
import type { Gateway } from "../gateway";
import type { gatewayType } from "../gateway-model-defaults";
import type { generatedForGateway, models } from "../models.generated";

export type InstalledGateway = InstanceType<typeof Gateway>;
export type GatewayType = typeof gatewayType;
export type GatewayProvider = GatewayProviderBase<GatewayType>;

export type GatewayModelIdMap = {
  [K in GatewayType]: Parameters<InstalledGateway["createLanguageModel"]>[0];
};

// Helper: check if tuple T contains element E
type TupleIncludes<T extends readonly unknown[], E> = T extends readonly [
  infer H,
  ...infer R,
]
  ? H extends E
    ? true
    : TupleIncludes<R, E>
  : false;

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

export type GatewayImageModelIdMap = {
  [K in GatewayType]:
    | Parameters<InstalledGateway["createImageModel"]>[0]
    | (K extends typeof generatedForGateway ? MultimodalImageModel : never);
};

export type GatewayVideoModelIdMap = {
  [K in GatewayType]: Parameters<InstalledGateway["createVideoModel"]>[0];
};
