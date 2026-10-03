import {
  formatRequirementDescription,
  isRequirementSatisfied,
} from "./config-requirements";
import type { EnvRequirement } from "./config-requirements";

/* oxlint-disable typescript/prefer-readonly-parameter-types -- moving it below executable initialization can obscure ordering and API ownership.
typescript/prefer-readonly-parameter-types (#565): MissingCredentialsError accepts requirements: readonly EnvRequirement[]; requirement; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
/** Shared explicit failure for installed integrations; never carries secret values. */
class MissingCredentialsError extends Error {
  public readonly code = "CHATJS_MISSING_CREDENTIALS";
  public readonly integration: string;
  public readonly requirements: readonly EnvRequirement[];

  public constructor(
    integration: string,
    requirements: readonly EnvRequirement[]
  ) {
    super(
      `Missing credentials for ${integration}: ${requirements.map((requirement) => formatRequirementDescription(requirement)).join("; ")}`
    );
    this.name = "MissingCredentialsError";
    this.integration = integration;
    this.requirements = requirements;
  }
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * no-magic-numbers (#517): missingRequirement uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): missingRequirement accepts requirement: EnvRequirement; env: NodeJS.ProcessEnv; group; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): missingRequirement preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
const missingRequirement = (
  requirement: EnvRequirement,
  env: NodeJS.ProcessEnv
): EnvRequirement | null => {
  if (requirement.allOf) {
    const allOf = requirement.allOf.flatMap((group) => {
      const missing = missingRequirement(group, env);
      return missing ? [missing] : [];
    });
    return allOf.length > 0 ? { ...requirement, allOf } : null;
  }
  return isRequirementSatisfied(requirement, env) ? null : requirement;
};
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/no-null */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types -- no-magic-numbers (#517): requireCredentials uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/prefer-readonly-parameter-types (#565): requireCredentials accepts requirements: readonly EnvRequirement[]; env: NodeJS.ProcessEnv; requirement; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
const requireCredentials = (
  integration: string,
  requirements: readonly EnvRequirement[],
  env: NodeJS.ProcessEnv
): void => {
  const missing = requirements.flatMap((requirement) => {
    const group = missingRequirement(requirement, env);
    return group ? [group] : [];
  });
  if (missing.length > 0) {
    throw new MissingCredentialsError(integration, missing);
  }
};
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types */
export { MissingCredentialsError, requireCredentials };
