import type { AuthenticationConfig } from "./config-schema";

type EnvVarName = keyof NodeJS.ProcessEnv;

export interface EnvRequirement {
  allOf?: EnvRequirement[];
  description?: string;
  options: EnvVarName[][];
  runtimeAuth?: string;
}

export const formatRequirementDescription = (
  requirement: EnvRequirement
): string => {
  if (requirement.allOf) {
    return requirement.allOf
      .map((group) => `(${formatRequirementDescription(group)})`)
      .join(" and ");
  }
  const keys = requirement.options
    .map((option) => option.join(" + "))
    .join(" or ");
  if (requirement.description && keys && requirement.description !== keys) {
    return `${requirement.description} (${keys})`;
  }
  return requirement.description ?? keys;
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
): boolean => {
  if (requirement.allOf) {
    return requirement.allOf.every((group) =>
      isRequirementSatisfied(group, env)
    );
  }
  return (
    (requirement.runtimeAuth === "vercel-oidc" && env.VERCEL === "1") ||
    requirement.options.some((option) => option.every((name) => !!env[name]))
  );
};

export const getMissingRequirement = (
  requirement: EnvRequirement,
  env: NodeJS.ProcessEnv
): string | null =>
  isRequirementSatisfied(requirement, env)
    ? null
    : formatRequirementDescription(requirement);
