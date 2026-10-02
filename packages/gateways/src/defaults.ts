import type { GatewayProvider } from "./gateway-provider.ts";

type AnyGatewayProvider = GatewayProvider<string, never, never, never>;

type VideoDefault<G extends AnyGatewayProvider> = {
  default?: Parameters<G["createVideoModel"]>[0];
};

type ImageDefault<G extends AnyGatewayProvider> = {
  default?: Parameters<G["createImageModel"]>[0];
};

export interface GatewayModelDefaults<G extends AnyGatewayProvider> {
  anonymousModels: Parameters<G["createLanguageModel"]>[0][];
  curatedDefaults: Parameters<G["createLanguageModel"]>[0][];
  disabledModels: Parameters<G["createLanguageModel"]>[0][];
  providerOrder: string[];
  tools: {
    followupSuggestions: {
      enabled: boolean;
      default: Parameters<G["createLanguageModel"]>[0];
    };
    text: { polish: Parameters<G["createLanguageModel"]>[0] };
    sheet: {
      format: Parameters<G["createLanguageModel"]>[0];
      analyze: Parameters<G["createLanguageModel"]>[0];
    };
    code: { edits: Parameters<G["createLanguageModel"]>[0] };
    image: ImageDefault<G>;
    video: VideoDefault<G>;
    deepResearch: {
      defaultModel: Parameters<G["createLanguageModel"]>[0];
      finalReportModel: Parameters<G["createLanguageModel"]>[0];
      allowClarification: boolean;
      maxResearcherIterations: number;
      maxConcurrentResearchUnits: number;
      maxSearchQueries: number;
    };
  };
  workflows: {
    chat: Parameters<G["createLanguageModel"]>[0];
    title: Parameters<G["createLanguageModel"]>[0];
    pdf: Parameters<G["createLanguageModel"]>[0];
    chatImageCompatible: Parameters<G["createLanguageModel"]>[0];
  };
}
