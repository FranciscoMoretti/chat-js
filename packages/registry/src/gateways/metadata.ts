export const gatewayMetadata = {
  vercel: {
    dependency: "@ai-sdk/gateway",
    exportName: "VercelGateway",
    supportsVideo: true,
    version: "4.0.145",
  },
  openai: {
    dependency: "@ai-sdk/openai",
    exportName: "OpenAIGateway",
    supportsVideo: false,
    version: "4.0.117",
  },
  "openai-compatible": {
    dependency: "@ai-sdk/openai-compatible",
    exportName: "OpenAICompatibleGateway",
    supportsVideo: false,
    version: "3.0.92",
  },
  openrouter: {
    dependency: "@openrouter/ai-sdk-provider",
    exportName: "OpenRouterGateway",
    supportsVideo: false,
    version: "3.0.0",
  },

  litellm: {
    dependency: "@ai-sdk/openai-compatible",
    exportName: "LiteLLMGateway",
    supportsVideo: false,
    version: "3.0.92",
  },
} as const;

export type GatewayType = keyof typeof gatewayMetadata;
