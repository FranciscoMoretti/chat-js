import {
  storageFieldValue,
  storageFieldIssue,
} from "../../../registry/storage-fields";
import { back, choose, promptValue } from "#cli/helpers/prompts";
import { parseStorageOptions } from "#cli/helpers/storage-provider";
import { builtInGateways, resolveGateway } from "#cli/registry/gateways";
import { builtInSandboxes } from "../../../registry/src/sandboxes/catalog";
import { resolveSandbox } from "#cli/registry/sandboxes";
import { resolveStorage } from "#cli/registry/storage";
import { storageItems } from "../../../registry/src/storage/items";
import {
  createCatalog,
  registryChoices,
  isCommonStorage,
} from "../../../registry/create-catalog";
import { installationCatalog } from "../../../registry/installation-catalog";
import type { InstallationSelection } from "../../../registry/installation";

const external = { value: "external", label: "External registry item" };

const validateOptions = (value: string): string | undefined => {
  try {
    parseStorageOptions(value);
    return globalThis.undefined;
  } catch {
    return "Enter a valid JSON object.";
  }
};

const providers = installationCatalog([
  ...builtInGateways,
  ...builtInSandboxes,
  ...storageItems,
]);
export const gatewayOptions = registryChoices(
  providers,
  createCatalog.gateway.source
).map((choice) => ({
  ...choice,
  hint: builtInGateways
    .find((gateway) => gateway.meta.chatjs.id === choice.value)
    ?.meta.chatjs.envRequirements.map(
      (requirement) =>
        requirement.description ??
        requirement.options.map((group) => group.join(" + ")).join(" or ")
    )
    .join(". "),
}));
export const sandboxOptions = registryChoices(
  providers,
  createCatalog.sandboxProvider.source
);
export const storageOptions = registryChoices(
  providers,
  createCatalog.storageProvider.source
);

const chooseProvider = async (
  message: string,
  options: { value: string; label: string; hint?: string }[],
  current: string | undefined,
  addressMessage: string
): Promise<string | undefined> => {
  for (;;) {
    /* eslint-disable no-await-in-loop -- An abandoned address returns to this picker. */
    const value = await choose(message, [...options, external, back], current);
    if (value !== external.value) {
      return value === back.value ? undefined : value;
    }
    const address = await promptValue(addressMessage);
    if (address !== undefined) {
      return address;
    }
    /* eslint-enable no-await-in-loop */
  }
};

export const editGateway = async (
  selection: InstallationSelection,
  cwd: string
): Promise<boolean> => {
  const address = await chooseProvider(
    "Which model gateway would you like to use?",
    gatewayOptions,
    selection.gateway,
    "Enter a gateway registry URL or local JSON path"
  );
  if (address === undefined) {
    return false;
  }
  await resolveGateway(address, cwd);
  selection.gateway = address;
  return true;
};

export const editSandbox = async (
  selection: InstallationSelection,
  cwd: string
): Promise<boolean> => {
  const address = await chooseProvider(
    "Which sandbox should the agent use?",
    sandboxOptions,
    selection.sandbox,
    "Enter a sandbox registry item address"
  );
  if (address === undefined) {
    return false;
  }
  await resolveSandbox(address, cwd);
  selection.sandbox = address;
  return true;
};

export const storageSettings = async (
  provider: string,
  definition: Readonly<
    Awaited<ReturnType<typeof resolveStorage>>["definition"]
  >,
  options: Record<string, unknown>
): Promise<Record<string, unknown> | undefined> => {
  const fields = definition.configFields ?? [];
  if (
    fields.length > 0 &&
    (provider === external.value ||
      fields.some((field) => field.type === "json"))
  ) {
    const json = await promptValue(
      `Non-secret storage settings as JSON (${fields.map(({ key }) => key).join(", ")})`,
      JSON.stringify(options),
      validateOptions
    );
    return json === undefined ? undefined : parseStorageOptions(json);
  }
  for (const field of fields) {
    const { key, label } = field;
    const existing = options[key];
    // eslint-disable-next-line no-await-in-loop -- Ask for one public setting at a time.
    const input = await promptValue(
      `Storage ${label} (${field.optional === true ? "optional" : "public setting"})`,
      typeof existing === "string" || typeof existing === "number"
        ? String(existing)
        : undefined,
      (value) =>
        storageFieldIssue(field, storageFieldValue(field, value.trim()))
    );
    if (input === undefined) {
      return undefined;
    }
    options[key] = storageFieldValue(field, input);
  }
  return options;
};

export const editStorage = async (
  selection: InstallationSelection,
  cwd: string
): Promise<boolean> => {
  const current = selection.storage;
  let showAll = false;
  for (;;) {
    /* eslint-disable no-await-in-loop -- Each step can return to the current picker. */
    const provider = await choose(
      showAll
        ? "Which file storage provider would you like to use?"
        : "Where should the app store files?",
      showAll
        ? [...storageOptions, back]
        : [
            ...storageOptions.filter(({ value }) => isCommonStorage(value)),
            { value: "more", label: "Show all providers" },
            external,
            back,
          ],
      current?.source
    );
    if (provider === back.value && !showAll) {
      return false;
    }
    if (provider === back.value || provider === "more") {
      showAll = provider === "more";
      continue;
    }
    const address =
      provider === external.value
        ? await promptValue("Enter a storage registry item address")
        : provider;
    if (address === undefined) {
      continue;
    }
    const { definition } = await resolveStorage(address, cwd);
    const options = await storageSettings(
      provider,
      definition,
      current && address === current.source ? { ...current.options } : {}
    );
    if (options !== undefined) {
      selection.storage = { source: address, options };
      return true;
    }
    /* eslint-enable no-await-in-loop */
  }
};
