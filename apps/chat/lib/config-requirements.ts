import type { AuthenticationConfig } from "./config-schema";

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

export interface EnvRequirement {
  allOf?: EnvRequirement[];
  description?: string;
  options: EnvVarName[][];
  runtimeAuth?: string;
}

/* oxlint-disable import/group-exports, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions  --
 * import/group-exports (#523): formatRequirementDescription stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named formatRequirementDescription API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * oxc/no-optional-chaining (#542): formatRequirementDescription handles optional requirement.description ?.split(ALTERNATIVE_SEPARATOR) .map((option) => option.split( without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/prefer-readonly-parameter-types (#565): formatRequirementDescription accepts requirement: EnvRequirement; group; option; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): formatRequirementDescription intentionally keeps the existing falsy-value behavior of requirement.description; groupsAlreadyListed; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
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
/* oxlint-enable import/group-exports, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): authEnvRequirements stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named authEnvRequirements API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
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
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports, typescript/prefer-readonly-parameter-types  --
 * import/group-exports (#523): isRequirementSatisfied stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named isRequirementSatisfied API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): isRequirementSatisfied accepts requirement: EnvRequirement; env: NodeJS.ProcessEnv; group; option; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable import/group-exports, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, typescript/prefer-readonly-parameter-types, unicorn/no-null  --
 * import/group-exports (#523): getMissingRequirement stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named getMissingRequirement API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-ternary (#518): getMissingRequirement derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * typescript/prefer-readonly-parameter-types (#565): getMissingRequirement accepts requirement: EnvRequirement; env: NodeJS.ProcessEnv; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): getMissingRequirement preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
export const getMissingRequirement = (
  requirement: EnvRequirement,
  env: NodeJS.ProcessEnv
): string | null =>
  isRequirementSatisfied(requirement, env)
    ? null
    : formatRequirementDescription(requirement);
/* oxlint-enable import/group-exports, typescript/prefer-readonly-parameter-types, unicorn/no-null */
