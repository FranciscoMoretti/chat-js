const gatewayMetadataEntries = [
  [
    "vercel",
    {
      dependency: "@ai-sdk/gateway",
      exportName: "VercelGateway",
      supportsVideo: true,
      version: "4.0.86",
    },
  ],
  [
    "openai",
    {
      dependency: "@ai-sdk/openai",
      exportName: "OpenAIGateway",
      supportsVideo: false,
      version: "4.0.59",
    },
  ],
  [
    "openai-compatible",
    {
      dependency: "@ai-sdk/openai-compatible",
      exportName: "OpenAICompatibleGateway",
      supportsVideo: false,
      version: "3.0.44",
    },
  ],
  [
    "openrouter",
    {
      dependency: "@openrouter/ai-sdk-provider",
      exportName: "OpenRouterGateway",
      supportsVideo: false,
      version: "3.0.0",
    },
  ],
  [
    "litellm",
    {
      dependency: "@ai-sdk/openai-compatible",
      exportName: "LiteLLMGateway",
      supportsVideo: false,
      version: "3.0.44",
    },
  ],
] as const;

type GatewayMetadataEntries = typeof gatewayMetadataEntries;

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Typed registry entries establish key/value correspondence that Object.fromEntries does not retain in its return type.
export const gatewayMetadata = Object.fromEntries(gatewayMetadataEntries) as {
  [Entry in GatewayMetadataEntries[number] as Entry[0]]: Entry[1];
};
/* oxlint-enable eslint/no-magic-numbers */

export type GatewayType = keyof typeof gatewayMetadata;
