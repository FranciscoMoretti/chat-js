import {
  formatRequirementDescription,
  isRequirementSatisfied,
} from "./config-requirements";
import type { EnvRequirement } from "./config-requirements";

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
