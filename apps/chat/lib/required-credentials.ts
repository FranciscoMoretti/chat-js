import {
  formatRequirementDescription,
  isRequirementSatisfied,
} from "./config-requirements";
import type { EnvRequirement } from "./config-requirements";

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

const missingRequirement = (
  requirement: EnvRequirement,
  env: Readonly<NodeJS.ProcessEnv>
): EnvRequirement | null => {
  if (requirement.allOf) {
    const allOf = requirement.allOf.flatMap((group) => {
      const missing = missingRequirement(group, env);
      if (missing) {
        return [missing];
      }
      return [];
    });
    if (allOf.length > 0) {
      return { ...requirement, allOf };
    }
    return null;
  }
  if (isRequirementSatisfied(requirement, env)) {
    return null;
  }
  return requirement;
};

const requireCredentials = (
  integration: string,
  requirements: readonly EnvRequirement[],
  env: Readonly<NodeJS.ProcessEnv>
): void => {
  const missing = requirements.flatMap((requirement) => {
    const group = missingRequirement(requirement, env);
    if (group) {
      return [group];
    }
    return [];
  });
  if (missing.length > 0) {
    throw new MissingCredentialsError(integration, missing);
  }
};

export { MissingCredentialsError, requireCredentials };
