import { builtInGateways } from "../registry/gateways";
import type { AuthProvider, BuiltInToolKey, CoreFeatureKey } from "../types";

type EnvVarName = string;

export interface EnvRequirement {
  description: string;
  options: EnvVarName[][];
}

export const gatewayEnvRequirements: Record<string, EnvRequirement[]> =
  Object.fromEntries(
    builtInGateways.map((item) => [
      item.meta.chatjs.id,
      item.meta.chatjs.envRequirements.map((requirement) => ({
        ...requirement,
        description:
          requirement.description ??
          requirement.options.map((option) => option.join(" + ")).join(" or "),
      })),
    ])
  );

export const coreFeatureEnvRequirements: Partial<
  Record<CoreFeatureKey, EnvRequirement>
> = {
  mcp: {
    description: "MCP_ENCRYPTION_KEY",
    options: [["MCP_ENCRYPTION_KEY"]],
  },
};

export const builtInToolEnvRequirements: Record<
  BuiltInToolKey,
  EnvRequirement | undefined
> = {
  codeExecution: undefined,
  deepResearch: {
    description: "TAVILY_API_KEY or FIRECRAWL_API_KEY",
    options: [["TAVILY_API_KEY"], ["FIRECRAWL_API_KEY"]],
  },
  imageGeneration: undefined,
  urlRetrieval: undefined,
  videoGeneration: undefined,
  webSearch: {
    description: "TAVILY_API_KEY or FIRECRAWL_API_KEY",
    options: [["TAVILY_API_KEY"], ["FIRECRAWL_API_KEY"]],
  },
};

export const authEnvRequirements: Record<AuthProvider, EnvRequirement> = {
  github: {
    description: "AUTH_GITHUB_ID + AUTH_GITHUB_SECRET",
    options: [["AUTH_GITHUB_ID", "AUTH_GITHUB_SECRET"]],
  },
  google: {
    description: "AUTH_GOOGLE_ID + AUTH_GOOGLE_SECRET",
    options: [["AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"]],
  },
  vercel: {
    description: "VERCEL_APP_CLIENT_ID + VERCEL_APP_CLIENT_SECRET",
    options: [["VERCEL_APP_CLIENT_ID", "VERCEL_APP_CLIENT_SECRET"]],
  },
};

export const envVarDescriptions: Record<string, string> = {
  AI_GATEWAY_API_KEY: "Vercel AI Gateway API key",
  AUTH_GITHUB_ID: "GitHub OAuth client id",
  AUTH_GITHUB_SECRET: "GitHub OAuth client secret",
  AUTH_GOOGLE_ID: "Google OAuth client id",
  AUTH_GOOGLE_SECRET: "Google OAuth client secret",
  AUTH_SECRET: "Secret used to sign auth sessions",
  DATABASE_URL: "Database connection string",
  FIRECRAWL_API_KEY: "Firecrawl API key for search/retrieval",
  LITELLM_API_KEY: "Optional API key for LiteLLM proxy",
  LITELLM_BASE_URL: "Base URL for LiteLLM proxy",
  MCP_ENCRYPTION_KEY: "Encryption key for MCP connector secrets",
  OPENAI_API_KEY: "OpenAI API key",
  OPENAI_COMPATIBLE_API_KEY: "API key for OpenAI-compatible gateway",
  OPENAI_COMPATIBLE_BASE_URL: "Base URL for OpenAI-compatible gateway",
  OPENROUTER_API_KEY: "OpenRouter API key",
  TAVILY_API_KEY: "Tavily API key for web search",
  VERCEL_APP_CLIENT_ID: "Vercel OAuth client id",
  VERCEL_APP_CLIENT_SECRET: "Vercel OAuth client secret",
  VERCEL_OIDC_TOKEN: "OIDC token available in Vercel runtime",
  VERCEL_PROJECT_ID: "Vercel project id for sandbox execution",
  VERCEL_TEAM_ID: "Vercel team id for sandbox execution",
  VERCEL_TOKEN: "Vercel token for sandbox execution",
};
