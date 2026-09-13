const gatewayMetadataEntries = [
  [
    "vercel",
    {
      dependency: "@ai-sdk/gateway",
      exportName: "VercelGateway",
      supportsVideo: true,
      version: "4.0.75",
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

export const gatewayMetadata = Object.fromEntries(gatewayMetadataEntries) as {
  [Entry in GatewayMetadataEntries[number] as Entry[0]]: Entry[1];
};

export type GatewayType = keyof typeof gatewayMetadata;
