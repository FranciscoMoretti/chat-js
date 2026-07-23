import type { GatewayType } from "./ai/gateways/registry";
import type { AiConfig, AuthenticationConfig } from "./config-schema";

type EnvVarName = keyof NodeJS.ProcessEnv;

export interface EnvRequirement {
  description?: string;
  options: EnvVarName[][];
}

export function formatRequirementDescription(
  requirement: EnvRequirement
): string {
  return (
    requirement.description ??
    requirement.options.map((option) => option.join(" + ")).join(" or ")
  );
}

export const gatewayEnvRequirements: Record<GatewayType, EnvRequirement> = {
  openrouter: {
    options: [["OPENROUTER_API_KEY"]],
    description: "OPENROUTER_API_KEY",
  },
  openai: {
    options: [["OPENAI_API_KEY"]],
    description: "OPENAI_API_KEY",
  },
  vercel: {
    options: [["AI_GATEWAY_API_KEY"], ["VERCEL_OIDC_TOKEN"]],
    description: "AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN",
  },
  "openai-compatible": {
    options: [["OPENAI_COMPATIBLE_BASE_URL", "OPENAI_COMPATIBLE_API_KEY"]],
    description: "OPENAI_COMPATIBLE_BASE_URL, OPENAI_COMPATIBLE_API_KEY",
  },
  litellm: {
    options: [["LITELLM_BASE_URL"]],
    description: "LITELLM_BASE_URL",
  },
};

export const aiToolEnvRequirements: Partial<
  Record<keyof AiConfig["tools"], EnvRequirement>
> = {
  webSearch: {
    // The direct webSearch tool selects a provider from the configured keys
    // (same priority as deepResearch: Tavily, then Firecrawl, then SERPdive),
    // so any one of these keys enables it.
    options: [["TAVILY_API_KEY"], ["FIRECRAWL_API_KEY"], ["SERPDIVE_API_KEY"]],
    description: "TAVILY_API_KEY or FIRECRAWL_API_KEY or SERPDIVE_API_KEY",
  },
  deepResearch: {
    options: [["TAVILY_API_KEY"], ["FIRECRAWL_API_KEY"], ["SERPDIVE_API_KEY"]],
    description: "TAVILY_API_KEY or FIRECRAWL_API_KEY or SERPDIVE_API_KEY",
  },
  mcp: {
    options: [["MCP_ENCRYPTION_KEY"]],
    description: "MCP_ENCRYPTION_KEY",
  },
  codeExecution: {
    options: [
      ["VERCEL_OIDC_TOKEN"],
      ["VERCEL_TEAM_ID", "VERCEL_PROJECT_ID", "VERCEL_TOKEN"],
    ],
    description:
      "VERCEL_OIDC_TOKEN (auto on Vercel) or VERCEL_TEAM_ID + VERCEL_PROJECT_ID + VERCEL_TOKEN",
  },
};

export const authEnvRequirements: Record<
  keyof AuthenticationConfig,
  EnvRequirement
> = {
  google: {
    options: [["AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"]],
    description: "AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET",
  },
  github: {
    options: [["AUTH_GITHUB_ID", "AUTH_GITHUB_SECRET"]],
    description: "AUTH_GITHUB_ID, AUTH_GITHUB_SECRET",
  },
  vercel: {
    options: [["VERCEL_APP_CLIENT_ID", "VERCEL_APP_CLIENT_SECRET"]],
    description: "VERCEL_APP_CLIENT_ID, VERCEL_APP_CLIENT_SECRET",
  },
};

export function isRequirementSatisfied(
  requirement: EnvRequirement,
  env: NodeJS.ProcessEnv
): boolean {
  return requirement.options.some((option) =>
    option.every((name) => !!env[name])
  );
}

export function getMissingRequirement(
  requirement: EnvRequirement,
  env: NodeJS.ProcessEnv
): string | null {
  return isRequirementSatisfied(requirement, env)
    ? null
    : formatRequirementDescription(requirement);
}
