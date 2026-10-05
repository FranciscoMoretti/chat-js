import type { EnvGroup, EnvVar, ProviderSlug } from "files-sdk/providers";
import { getProvider } from "files-sdk/providers";

/* oxlint-disable typescript/consistent-type-definitions -- Preserve this exported closed-record type's existing implicit assignability to Record<string, unknown>; an augmentable interface changes that public type contract. */
type StorageEnvironmentVariable = {
  aliases: readonly string[];
  description: string;
  key: string;
  secret: boolean;
};
/* oxlint-enable typescript/consistent-type-definitions */

/* oxlint-disable typescript/consistent-type-definitions -- Preserve this exported closed-record type's existing implicit assignability to Record<string, unknown>; an augmentable interface changes that public type contract. */
type StorageEnvironmentRequirement = {
  description: string;
  options: StorageEnvironmentVariable[][];
};
/* oxlint-enable typescript/consistent-type-definitions */

const EMPTY_VARIABLE_COUNT = 0;
/* oxlint-disable eslint/no-undefined -- Files SDK adapter options count as supplied even when null; only a missing or explicitly undefined option leaves the environment requirement active. */
const ABSENT_ADAPTER_OPTION = undefined;
/* oxlint-enable eslint/no-undefined */

const STORAGE_OPTION_HINT = /(?:or )?pass `(?<option>[^`]+)`/u;

const toVariable = (
  variable: Readonly<{
    aliases?: readonly string[];
    description: string;
    key: string;
    secret: boolean;
  }>
): StorageEnvironmentVariable => ({
  aliases: variable.aliases ?? [],
  description: variable.description,
  key: variable.key,
  secret: variable.secret,
});

const credentialOptions = (
  modes: readonly Readonly<{
    label: string;
    vars: readonly Readonly<EnvGroup["vars"][number]>[];
  }>[],
  adapterOptions: Readonly<Record<string, unknown>>
): StorageEnvironmentVariable[][] => {
  const credentialModes: StorageEnvironmentVariable[][] = [];
  let hasUnvalidatedCredentialMode = false;
  for (const mode of modes) {
    const variables = mode.vars
      .filter((variable) => variable.readBy === "files-sdk")
      .map((variable: Readonly<EnvVar>) => toVariable(variable));
    if (variables.length > EMPTY_VARIABLE_COUNT) {
      credentialModes.push(variables);
    } else {
      const optionName = STORAGE_OPTION_HINT.exec(mode.label)?.groups?.option;
      hasUnvalidatedCredentialMode ||=
        optionName === ABSENT_ADAPTER_OPTION ||
        adapterOptions[optionName] !== ABSENT_ADAPTER_OPTION;
    }
  }
  return credentialModes.length > EMPTY_VARIABLE_COUNT &&
    !hasUnvalidatedCredentialMode
    ? credentialModes
    : [];
};

const requiresEnvironmentVariable = (
  variable: Readonly<EnvVar>,
  adapterOptions: Readonly<Record<string, unknown>>
): boolean => {
  const optionName = STORAGE_OPTION_HINT.exec(variable.description)?.groups
    ?.option;
  return (
    variable.readBy === "files-sdk" &&
    !(
      typeof optionName === "string" &&
      optionName !== "" &&
      !variable.secret &&
      adapterOptions[optionName] !== ABSENT_ADAPTER_OPTION
    )
  );
};

const getStorageEnvironmentRequirements = (
  provider: ProviderSlug,
  adapterOptions: Readonly<Record<string, unknown>> = {}
): StorageEnvironmentRequirement[] => {
  const metadata = getProvider(provider);
  if (!metadata) {
    return [];
  }

  const required = metadata.env.required?.filter((variable: Readonly<EnvVar>) =>
    requiresEnvironmentVariable(variable, adapterOptions)
  );
  const requirements: StorageEnvironmentRequirement[] =
    required && required.length > EMPTY_VARIABLE_COUNT
      ? [
          {
            description: `${metadata.name} configuration`,
            options: [
              required.map((variable: Readonly<EnvVar>) =>
                toVariable(variable)
              ),
            ],
          },
        ]
      : [];

  const options = credentialOptions(
    metadata.env.credentialModes ?? [],
    adapterOptions
  );
  if (options.length > EMPTY_VARIABLE_COUNT) {
    requirements.push({ description: `${metadata.name} credentials`, options });
  }

  return requirements;
};
export { getStorageEnvironmentRequirements };
export type { StorageEnvironmentRequirement, StorageEnvironmentVariable };
