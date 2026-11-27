import type { CreateIcon } from "../../create-icons";

export const gatewayMetadata = {
  vercel: {
    icon: "setup/vercel" satisfies CreateIcon,
    dependency: "@ai-sdk/gateway",
    exportName: "VercelGateway",
    supportsVideo: true,
    version: "4.0.145",
  },
  openai: {
    icon: "setup/openai" satisfies CreateIcon,
    dependency: "@ai-sdk/openai",
    exportName: "OpenAIGateway",
    supportsVideo: false,
    version: "4.0.117",
  },
  "openai-compatible": {
    icon: "plug" satisfies CreateIcon,
    dependency: "@ai-sdk/openai-compatible",
    exportName: "OpenAICompatibleGateway",
    supportsVideo: false,
    version: "3.0.92",
  },
  openrouter: {
    icon: "setup/openrouter" satisfies CreateIcon,
    dependency: "@openrouter/ai-sdk-provider",
    exportName: "OpenRouterGateway",
    supportsVideo: false,
    version: "3.0.0",
  },

  litellm: {
    icon: "route" satisfies CreateIcon,
    dependency: "@ai-sdk/openai-compatible",
    exportName: "LiteLLMGateway",
    supportsVideo: false,
    version: "3.0.92",
  },
} as const;

export type GatewayType = keyof typeof gatewayMetadata;
