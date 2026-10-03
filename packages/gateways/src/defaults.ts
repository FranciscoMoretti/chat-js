import type { GatewayProvider } from "./gateway-provider.ts";

type AnyGatewayProvider = GatewayProvider<string, never, never, never>;

/* oxlint-disable typescript/consistent-type-definitions -- Keep this structural alias closed to declaration merging and compatible with the existing generic/record API. */
/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
type VideoDefault<G extends AnyGatewayProvider> = {
  default?: Parameters<G["createVideoModel"]>[0];
};
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/id-length */
/* oxlint-enable typescript/consistent-type-definitions */

/* oxlint-disable typescript/consistent-type-definitions -- Keep this structural alias closed to declaration merging and compatible with the existing generic/record API. */
/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
type ImageDefault<G extends AnyGatewayProvider> = {
  default?: Parameters<G["createImageModel"]>[0];
};
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/id-length */
/* oxlint-enable typescript/consistent-type-definitions */

/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
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
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/id-length */
/* oxlint-enable import/no-named-export */
