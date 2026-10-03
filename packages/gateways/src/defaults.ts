import type { GatewayProvider } from "./gateway-provider.ts";

type AnyGatewayProvider = GatewayProvider<string, never, never, never>;

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
interface VideoDefault<TGateway extends AnyGatewayProvider> {
  default?: Parameters<TGateway["createVideoModel"]>[0];
}
/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
interface ImageDefault<TGateway extends AnyGatewayProvider> {
  default?: Parameters<TGateway["createImageModel"]>[0];
}
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
interface GatewayModelDefaults<TGateway extends AnyGatewayProvider> {
  anonymousModels: Parameters<TGateway["createLanguageModel"]>[0][];
  curatedDefaults: Parameters<TGateway["createLanguageModel"]>[0][];
  disabledModels: Parameters<TGateway["createLanguageModel"]>[0][];
  providerOrder: string[];
  tools: {
    followupSuggestions: {
      enabled: boolean;
      default: Parameters<TGateway["createLanguageModel"]>[0];
    };
    text: { polish: Parameters<TGateway["createLanguageModel"]>[0] };
    sheet: {
      format: Parameters<TGateway["createLanguageModel"]>[0];
      analyze: Parameters<TGateway["createLanguageModel"]>[0];
    };
    code: { edits: Parameters<TGateway["createLanguageModel"]>[0] };
    image: ImageDefault<TGateway>;
    video: VideoDefault<TGateway>;
    deepResearch: {
      defaultModel: Parameters<TGateway["createLanguageModel"]>[0];
      finalReportModel: Parameters<TGateway["createLanguageModel"]>[0];
      allowClarification: boolean;
      maxResearcherIterations: number;
      maxConcurrentResearchUnits: number;
      maxSearchQueries: number;
    };
  };
  workflows: {
    chat: Parameters<TGateway["createLanguageModel"]>[0];
    title: Parameters<TGateway["createLanguageModel"]>[0];
    pdf: Parameters<TGateway["createLanguageModel"]>[0];
    chatImageCompatible: Parameters<TGateway["createLanguageModel"]>[0];
  };
}
/* oxlint-enable eslint/no-magic-numbers */

export type { GatewayModelDefaults };
