export const gatewayMetadata = {
  vercel: {
    exportName: "VercelGateway",
    supportsVideo: true,
    dependency: "@ai-sdk/gateway",
    version: "4.0.75",
  },
  openai: {
    exportName: "OpenAIGateway",
    supportsVideo: false,
    dependency: "@ai-sdk/openai",
    version: "4.0.59",
  },
  "openai-compatible": {
    exportName: "OpenAICompatibleGateway",
    supportsVideo: false,
    dependency: "@ai-sdk/openai-compatible",
    version: "3.0.44",
  },
  openrouter: {
    exportName: "OpenRouterGateway",
    supportsVideo: false,
    dependency: "@openrouter/ai-sdk-provider",
    version: "3.0.0",
  },
  litellm: {
    exportName: "LiteLLMGateway",
    supportsVideo: false,
    dependency: "@ai-sdk/openai-compatible",
    version: "3.0.44",
  },
} as const;

export type GatewayType = keyof typeof gatewayMetadata;
