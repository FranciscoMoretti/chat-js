import { codeExecutionEnvRequirement } from "@/tools/chatjs/code-execution-config";
import { imageGenerationEnvRequirement } from "@/tools/chatjs/image-generation-config";
import { searchEnvRequirement } from "@/tools/chatjs/search-config";
import { urlRetrievalEnvRequirement } from "@/tools/chatjs/url-retrieval-config";

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

export const aiToolEnvRequirements: Partial<
  Record<keyof AiConfig["tools"], EnvRequirement>
> = {
  image: imageGenerationEnvRequirement,
  urlRetrieval: urlRetrievalEnvRequirement,
  webSearch: searchEnvRequirement,
  deepResearch: searchEnvRequirement,
  mcp: {
    options: [["MCP_ENCRYPTION_KEY"]],
    description: "MCP_ENCRYPTION_KEY",
  },
  codeExecution: codeExecutionEnvRequirement,
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
