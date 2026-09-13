import { codeExecutionEnvRequirement } from "@/tools/chatjs/code-execution-config";
import { imageGenerationEnvRequirement } from "@/tools/chatjs/image-generation-config";
import { searchEnvRequirement } from "@/tools/chatjs/search-config";
import { urlRetrievalEnvRequirement } from "@/tools/chatjs/url-retrieval-config";
import { videoGenerationEnvRequirement } from "@/tools/chatjs/video-generation-config";

import type { AiConfig, AuthenticationConfig } from "./config-schema";

type EnvVarName = keyof NodeJS.ProcessEnv;

export interface EnvRequirement {
  description?: string;
  options: EnvVarName[][];
}

export const formatRequirementDescription = (
  requirement: EnvRequirement
): string =>
  requirement.description ??
  requirement.options.map((option) => option.join(" + ")).join(" or ");

export const aiToolEnvRequirements: Partial<
  Record<keyof AiConfig["tools"], EnvRequirement>
> = {
  codeExecution: codeExecutionEnvRequirement,
  deepResearch: searchEnvRequirement,
  image: imageGenerationEnvRequirement,
  mcp: {
    description: "MCP_ENCRYPTION_KEY",
    options: [["MCP_ENCRYPTION_KEY"]],
  },
  urlRetrieval: urlRetrievalEnvRequirement,
  video: videoGenerationEnvRequirement,
  webSearch: searchEnvRequirement,
};

export const authEnvRequirements: Record<
  keyof AuthenticationConfig,
  EnvRequirement
> = {
  github: {
    description: "AUTH_GITHUB_ID, AUTH_GITHUB_SECRET",
    options: [["AUTH_GITHUB_ID", "AUTH_GITHUB_SECRET"]],
  },
  google: {
    description: "AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET",
    options: [["AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"]],
  },
  vercel: {
    description: "VERCEL_APP_CLIENT_ID, VERCEL_APP_CLIENT_SECRET",
    options: [["VERCEL_APP_CLIENT_ID", "VERCEL_APP_CLIENT_SECRET"]],
  },
};

export const isRequirementSatisfied = (
  requirement: EnvRequirement,
  env: NodeJS.ProcessEnv
): boolean =>
  requirement.options.some((option) => option.every((name) => !!env[name]));

export const getMissingRequirement = (
  requirement: EnvRequirement,
  env: NodeJS.ProcessEnv
): string | null =>
  isRequirementSatisfied(requirement, env)
    ? null
    : formatRequirementDescription(requirement);
