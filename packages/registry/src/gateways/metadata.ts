/* oxlint-disable import/no-named-export -- Keep the published named metadata binding; no-default-export rejects its default-export alternative. */
// oxlint-disable-next-line sort-keys -- Preserve the CLI provider menu order: Vercel first and LiteLLM last.
export const gatewayMetadata = {
  vercel: {
    dependency: "@ai-sdk/gateway",
    exportName: "VercelGateway",
    supportsVideo: true,
    version: "4.0.86",
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

  litellm: {
    dependency: "@ai-sdk/openai-compatible",
    exportName: "LiteLLMGateway",
    supportsVideo: false,
    version: "3.0.44",
  },
} as const;
/* oxlint-enable import/no-named-export */

/* oxlint-disable import/no-named-export -- Keep the named type bindings (GatewayType); the enabled import/no-default-export convention rejects the default-export alternative. */
export type GatewayType = keyof typeof gatewayMetadata;
/* oxlint-enable import/no-named-export */
