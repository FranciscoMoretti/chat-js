import type { ConfigMediaModelId } from "./provider-types.ts";
import type { GatewayProvider } from "./gateway-provider.ts";

const MODEL_ID_PARAMETER_INDEX = 0;

interface GatewayModelDefaults<TGateway extends GatewayProvider> {
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
  roles: {
    fast: Parameters<
      TGateway["createLanguageModel"]
    >[typeof MODEL_ID_PARAMETER_INDEX];
    balanced: Parameters<
      TGateway["createLanguageModel"]
    >[typeof MODEL_ID_PARAMETER_INDEX];
    smart: Parameters<
      TGateway["createLanguageModel"]
    >[typeof MODEL_ID_PARAMETER_INDEX];
    image?: ConfigMediaModelId<TGateway["createImageModel"]>;
    video?: ConfigMediaModelId<TGateway["createVideoModel"]>;
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
