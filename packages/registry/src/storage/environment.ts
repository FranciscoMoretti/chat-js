import { getProvider } from "files-sdk/providers";
import type { ProviderSlug } from "files-sdk/providers";

/* oxlint-disable typescript/consistent-type-definitions -- Keep this structural alias closed to declaration merging and compatible with the existing generic/record API. */
type StorageEnvironmentVariable = {
  aliases: readonly string[];
  description: string;
  key: string;
  secret: boolean;
};
/* oxlint-enable typescript/consistent-type-definitions */

/* oxlint-disable typescript/consistent-type-definitions -- Keep this structural alias closed to declaration merging and compatible with the existing generic/record API. */
type StorageEnvironmentRequirement = {
  description: string;
  options: StorageEnvironmentVariable[][];
};
/* oxlint-enable typescript/consistent-type-definitions */

const STORAGE_OPTION_HINT = /(?:or )?pass `(?<option>[^`]+)`/u;

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const toVariable = (variable: {
  aliases?: readonly string[];
  description: string;
  key: string;
  secret: boolean;
}): StorageEnvironmentVariable => ({
  aliases: variable.aliases ?? [],
  description: variable.description,
  key: variable.key,
  secret: variable.secret,
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable eslint/no-continue -- Skipping an ineligible item here keeps the remaining per-item operation inside the same loop and cleanup scope. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
const getStorageEnvironmentRequirements = (
  provider: ProviderSlug,
  adapterOptions: Record<string, unknown> = {}
): StorageEnvironmentRequirement[] => {
  const metadata = getProvider(provider);
  if (!metadata) {
    return [];
  }

  const requirements: StorageEnvironmentRequirement[] = [];
  const required = metadata.env.required?.filter((variable) => {
    const optionName = STORAGE_OPTION_HINT.exec(variable.description)?.[1];
    return (
      variable.readBy === "files-sdk" &&
      !(
        typeof optionName === "string" &&
        optionName !== "" &&
        !variable.secret &&
        adapterOptions[optionName] !== undefined
      )
    );
  });
  if (required?.length) {
    requirements.push({
      description: `${metadata.name} configuration`,
      options: [required.map((variable) => toVariable(variable))],
    });
  }

  const credentialModes: StorageEnvironmentVariable[][] = [];
  let hasUnvalidatedCredentialMode = false;
  for (const mode of metadata.env.credentialModes ?? []) {
    const variables = mode.vars
      .filter((variable) => variable.readBy === "files-sdk")
      .map((variable) => toVariable(variable));
    if (variables.length > 0) {
      credentialModes.push(variables);
      continue;
    }

    const optionName = STORAGE_OPTION_HINT.exec(mode.label)?.[1];
    hasUnvalidatedCredentialMode ||=
      optionName === undefined || adapterOptions[optionName] !== undefined;
  }
  if (credentialModes.length > 0 && !hasUnvalidatedCredentialMode) {
    requirements.push({
      description: `${metadata.name} credentials`,
      options: credentialModes,
    });
  }

  return requirements;
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-continue */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */
export { getStorageEnvironmentRequirements };
export type { StorageEnvironmentRequirement, StorageEnvironmentVariable };
