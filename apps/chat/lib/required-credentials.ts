import {
  formatRequirementDescription,
  isRequirementSatisfied,
} from "./config-requirements";
import type { EnvRequirement } from "./config-requirements";

/* oxlint-disable typescript/prefer-readonly-parameter-types -- The exported error exposes the original EnvRequirement objects through its requirements property; converting inputs to deeply readonly would change that mutable public contract or require cloning. */
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

/* oxlint-disable typescript/prefer-readonly-parameter-types, unicorn/no-null -- Return the original mutable requirement for an unsatisfied leaf and null for satisfied leaves; callers expose those same objects through MissingCredentialsError. */
const missingRequirement = (
  requirement: EnvRequirement,
  env: Readonly<NodeJS.ProcessEnv>
): EnvRequirement | null => {
  if (requirement.allOf) {
    const allOf = requirement.allOf.flatMap((group) => {
      const missing = missingRequirement(group, env);
      return missing ? [missing] : [];
    });
    // oxlint-disable-next-line no-magic-numbers, oxc/no-rest-spread-properties -- Explicit array emptiness uses zero as required by unicorn/explicit-length-check. Rest/spread: Keep the existing requirement own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    return allOf.length > 0 ? { ...requirement, allOf } : null;
  }
  return isRequirementSatisfied(requirement, env) ? null : requirement;
};
/* oxlint-enable typescript/prefer-readonly-parameter-types, unicorn/no-null */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- MissingCredentialsError preserves mutable requirement objects from this input; deep readonly requirements cannot be returned through its existing public property. */
const requireCredentials = (
  integration: string,
  requirements: readonly EnvRequirement[],
  env: Readonly<NodeJS.ProcessEnv>
): void => {
  const missing = requirements.flatMap((requirement) => {
    const group = missingRequirement(requirement, env);
    return group ? [group] : [];
  });
  // oxlint-disable-next-line no-magic-numbers -- Explicit array emptiness uses zero as required by unicorn/explicit-length-check.
  if (missing.length > 0) {
    throw new MissingCredentialsError(integration, missing);
  }
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (MissingCredentialsError, requireCredentials); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
export { MissingCredentialsError, requireCredentials };
/* oxlint-enable import/no-named-export */
