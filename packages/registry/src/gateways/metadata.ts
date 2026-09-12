export const gatewayMetadata = {
  litellm: {
    dependency: "@ai-sdk/openai-compatible",
    exportName: "LiteLLMGateway",
    supportsVideo: false,
    version: "3.0.44",
  },
  openai: {
    dependency: "@ai-sdk/openai",
    exportName: "OpenAIGateway",
    supportsVideo: false,
    version: "4.0.59",
  },
  "openai-compatible": {
    dependency: "@ai-sdk/openai-compatible",
    exportName: "OpenAICompatibleGateway",
    supportsVideo: false,
    version: "3.0.44",
  },
  openrouter: {
    dependency: "@openrouter/ai-sdk-provider",
    exportName: "OpenRouterGateway",
    supportsVideo: false,
    version: "3.0.0",
  },
  vercel: {
    dependency: "@ai-sdk/gateway",
    exportName: "VercelGateway",
    supportsVideo: true,
    version: "4.0.75",
  },
} as const;

export type GatewayType = keyof typeof gatewayMetadata;
