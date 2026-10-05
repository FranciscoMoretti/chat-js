import type { AuthenticationConfig } from "./config-schema";
import type { ReadonlyNativeSurface } from "./readonly-native-surface";

type EnvVarName = keyof NodeJS.ProcessEnv;
const ALTERNATIVE_SEPARATOR = /\s+or\s+/u;
const CREDENTIAL_SEPARATOR = /[+,]/u;

const normalizedCredentialGroups = (
  groups: readonly (readonly string[])[]
): string =>
  groups
    .map((group) => group.toSorted().join(" + "))
    .toSorted()
    .join(" or ");

interface EnvRequirement {
  allOf?: EnvRequirement[];
  description?: string;
  options: EnvVarName[][];
  runtimeAuth?: string;
}

const formatRequirementDescription = (
  requirement: ReadonlyNativeSurface<EnvRequirement>
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
    Array.isArray(describedOptions) &&
    normalizedCredentialGroups(describedOptions) ===
      normalizedCredentialGroups(
        requirement.options.map((option) => option.map(String))
      );
  if (
    typeof requirement.description === "string" &&
    requirement.description !== "" &&
    keys !== "" &&
    !groupsAlreadyListed
  ) {
    return `${requirement.description} (${keys})`;
  }
  return typeof requirement.description === "string" &&
    requirement.description !== ""
    ? requirement.description
    : keys;
};

const authEnvRequirements: Record<keyof AuthenticationConfig, EnvRequirement> =
  {
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

const isRequirementSatisfied = (
  requirement: ReadonlyNativeSurface<EnvRequirement>,
  env: Readonly<NodeJS.ProcessEnv>
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

const getMissingRequirement = (
  requirement: ReadonlyNativeSurface<EnvRequirement>,
  env: Readonly<NodeJS.ProcessEnv>
): string | null =>
  isRequirementSatisfied(requirement, env)
    ? // oxlint-disable-next-line unicorn/no-null -- Missing requirements use null as the existing exported success sentinel.
      null
    : formatRequirementDescription(requirement);
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (authEnvRequirements, formatRequirementDescription, getMissingRequirement, isRequirementSatisfied); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export {
  authEnvRequirements,
  formatRequirementDescription,
  getMissingRequirement,
  isRequirementSatisfied,
};
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (EnvRequirement); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { EnvRequirement };
/* oxlint-enable import/no-named-export */
