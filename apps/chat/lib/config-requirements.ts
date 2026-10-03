import type { AuthenticationConfig } from "./config-schema";

type EnvVarName = keyof NodeJS.ProcessEnv;
const ALTERNATIVE_SEPARATOR = /\s+or\s+/u;
const CREDENTIAL_SEPARATOR = /[+,]/u;

const normalizedCredentialGroups = (groups: readonly (readonly string[])[]) =>
  groups
    .map((group) => group.toSorted().join(" + "))
    .toSorted()
    .join(" or ");

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
  const describedOptions = requirement.description
    ?.split(ALTERNATIVE_SEPARATOR)
    .map((option) =>
      option.split(CREDENTIAL_SEPARATOR).map((name) => name.trim())
    );
  const groupsAlreadyListed =
    describedOptions &&
    normalizedCredentialGroups(describedOptions) ===
      normalizedCredentialGroups(
        requirement.options.map((option) => option.map(String))
      );
  if (requirement.description && keys && !groupsAlreadyListed) {
    return `${requirement.description} (${keys})`;
  }
  // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: Empty text or a falsy optional value deliberately selects the fallback; nullish coalescing would preserve that empty value.
  return requirement.description || keys;
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
    requirement.options.some((option) =>
      option.every((name) => Boolean(env[name]))
    )
  );
};

export const getMissingRequirement = (
  requirement: EnvRequirement,
  env: NodeJS.ProcessEnv
): string | null =>
  isRequirementSatisfied(requirement, env)
    ? null
    : formatRequirementDescription(requirement);
