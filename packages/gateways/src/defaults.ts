import type { GatewayProvider } from "./gateway-provider.ts";

const MODEL_ID_PARAMETER_INDEX = 0;

type AnyGatewayProvider = GatewayProvider<string, never, never, never>;

interface VideoDefault<TGateway extends AnyGatewayProvider> {
  default?: Parameters<
    TGateway["createVideoModel"]
  >[typeof MODEL_ID_PARAMETER_INDEX];
}

interface ImageDefault<TGateway extends AnyGatewayProvider> {
  default?: Parameters<
    TGateway["createImageModel"]
  >[typeof MODEL_ID_PARAMETER_INDEX];
}
interface GatewayModelDefaults<TGateway extends AnyGatewayProvider> {
  anonymousModels: Parameters<
    TGateway["createLanguageModel"]
  >[typeof MODEL_ID_PARAMETER_INDEX][];
  curatedDefaults: Parameters<
    TGateway["createLanguageModel"]
  >[typeof MODEL_ID_PARAMETER_INDEX][];
  disabledModels: Parameters<
    TGateway["createLanguageModel"]
  >[typeof MODEL_ID_PARAMETER_INDEX][];
  providerOrder: string[];
  tools: {
    followupSuggestions: {
      enabled: boolean;
      default: Parameters<
        TGateway["createLanguageModel"]
      >[typeof MODEL_ID_PARAMETER_INDEX];
    };
    text: {
      polish: Parameters<
        TGateway["createLanguageModel"]
      >[typeof MODEL_ID_PARAMETER_INDEX];
    };
    sheet: {
      format: Parameters<
        TGateway["createLanguageModel"]
      >[typeof MODEL_ID_PARAMETER_INDEX];
      analyze: Parameters<
        TGateway["createLanguageModel"]
      >[typeof MODEL_ID_PARAMETER_INDEX];
    };
    code: {
      edits: Parameters<
        TGateway["createLanguageModel"]
      >[typeof MODEL_ID_PARAMETER_INDEX];
    };
    image: ImageDefault<TGateway>;
    video: VideoDefault<TGateway>;
    deepResearch: {
      defaultModel: Parameters<
        TGateway["createLanguageModel"]
      >[typeof MODEL_ID_PARAMETER_INDEX];
      finalReportModel: Parameters<
        TGateway["createLanguageModel"]
      >[typeof MODEL_ID_PARAMETER_INDEX];
      allowClarification: boolean;
      maxResearcherIterations: number;
      maxConcurrentResearchUnits: number;
      maxSearchQueries: number;
    };
  };
  workflows: {
    chat: Parameters<
      TGateway["createLanguageModel"]
    >[typeof MODEL_ID_PARAMETER_INDEX];
    title: Parameters<
      TGateway["createLanguageModel"]
    >[typeof MODEL_ID_PARAMETER_INDEX];
    pdf: Parameters<
      TGateway["createLanguageModel"]
    >[typeof MODEL_ID_PARAMETER_INDEX];
    chatImageCompatible: Parameters<
      TGateway["createLanguageModel"]
    >[typeof MODEL_ID_PARAMETER_INDEX];
  };
}

export type { GatewayModelDefaults };
