import {
  formatRequirementDescription,
  isRequirementSatisfied,
} from "./config-requirements";
import type { EnvRequirement } from "./config-requirements";

/** Shared explicit failure for installed integrations; never carries secret values. */
export class MissingCredentialsError extends Error {
  readonly code = "CHATJS_MISSING_CREDENTIALS";
  readonly integration: string;
  readonly requirements: readonly EnvRequirement[];

  constructor(integration: string, requirements: readonly EnvRequirement[]) {
    super(
      `Missing credentials for ${integration}: ${requirements.map(formatRequirementDescription).join("; ")}`
    );
    this.name = "MissingCredentialsError";
    this.integration = integration;
    this.requirements = requirements;
  }
}

export const requireCredentials = (
  integration: string,
  requirements: readonly EnvRequirement[],
  env: NodeJS.ProcessEnv
): void => {
  const missing = requirements.filter(
    (requirement) => !isRequirementSatisfied(requirement, env)
  );
  if (missing.length) {
    throw new MissingCredentialsError(integration, missing);
  }
};
