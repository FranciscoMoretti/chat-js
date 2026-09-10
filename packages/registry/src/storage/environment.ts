import { getProvider, type ProviderSlug } from "files-sdk/providers";

export type StorageEnvironmentVariable = {
  aliases: readonly string[];
  description: string;
  key: string;
  secret: boolean;
};

export type StorageEnvironmentRequirement = {
  description: string;
  options: StorageEnvironmentVariable[][];
};

const STORAGE_OPTION_HINT = /(?:or )?pass `([^`]+)`/;

export function getStorageEnvironmentRequirements(
  provider: ProviderSlug,
  adapterOptions: Record<string, unknown> = {}
): StorageEnvironmentRequirement[] {
  const metadata = getProvider(provider);
  if (!metadata) {
    return [];
  }

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
  const requirements: StorageEnvironmentRequirement[] = [];
  const required = metadata.env.required?.filter((variable) => {
    const optionName = STORAGE_OPTION_HINT.exec(variable.description)?.[1];
    return (
      variable.readBy === "files-sdk" &&
      !(
        optionName &&
        variable.secret === false &&
        adapterOptions[optionName] !== undefined
      )
    );
  });
  if (required?.length) {
    requirements.push({
      description: `${metadata.name} configuration`,
      options: [required.map(toVariable)],
    });
  }

  const credentialModes: StorageEnvironmentVariable[][] = [];
  let hasUnvalidatedCredentialMode = false;
  for (const mode of metadata.env.credentialModes ?? []) {
    const variables = mode.vars
      .filter((variable) => variable.readBy === "files-sdk")
      .map(toVariable);
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
}
