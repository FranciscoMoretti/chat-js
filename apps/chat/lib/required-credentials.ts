import {
  formatRequirementDescription,
  isRequirementSatisfied,
} from "./config-requirements";
import type { EnvRequirement } from "./config-requirements";

/* oxlint-disable import/exports-last, import/group-exports, typescript/prefer-readonly-parameter-types  --
 * import/exports-last (#522): MissingCredentialsError is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): MissingCredentialsError stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named MissingCredentialsError API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): MissingCredentialsError accepts requirements: readonly EnvRequirement[]; requirement; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/** Shared explicit failure for installed integrations; never carries secret values. */
export class MissingCredentialsError extends Error {
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
/* oxlint-enable import/exports-last, import/group-exports, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/no-null  --
 * no-magic-numbers (#517): missingRequirement uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): missingRequirement derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * oxc/no-rest-spread-properties (#543): missingRequirement copies or separates ...requirement while preserving existing object ownership; mutating source objects is not equivalent.
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

/* oxlint-disable import/group-exports, no-magic-numbers, typescript/prefer-readonly-parameter-types  --
 * import/group-exports (#523): requireCredentials stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named requireCredentials API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): requireCredentials uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): requireCredentials derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * typescript/prefer-readonly-parameter-types (#565): requireCredentials accepts requirements: readonly EnvRequirement[]; env: NodeJS.ProcessEnv; requirement; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const requireCredentials = (
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
/* oxlint-enable import/group-exports, no-magic-numbers, typescript/prefer-readonly-parameter-types */
