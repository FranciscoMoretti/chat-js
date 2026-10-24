import {
  configureSandboxProvider,
  sandboxProviderTargets,
} from "#cli/helpers/sandbox-provider";
import { resolveSandbox } from "#cli/registry/sandboxes";
import { access, writeFile } from "node:fs/promises";
import { syncPlugins } from "#cli/utils/sync-plugins";
import {
  configureStorageProvider,
  parseStorageOptions,
} from "#cli/helpers/storage-provider";
import { confirm, isCancel, log } from "@clack/prompts";
import { Command } from "commander";
import { configureGatewayProvider } from "#cli/helpers/gateway-provider";
import { gatewayConfigEdit } from "#cli/utils/provider-config";
import { handleError } from "#cli/utils/handle-error";
import { inferPackageManager } from "#cli/utils/get-package-manager";
import { installPlan } from "#cli/utils/install-plan";
import path from "node:path";
import { planInstallation } from "#cli/utils/installation-plan";
import { resolveGateway } from "#cli/registry/gateways";
import { resolveStorage } from "#cli/registry/storage";
import { runCommand } from "#cli/utils/run-command";
import { syncTools } from "#cli/utils/sync-tools";

type ReadonlyNative<Value> = Value extends (
  ...args: readonly never[]
) => unknown
  ? Value
  : Value extends object
    ? { readonly [Key in keyof Value]: ReadonlyNative<Value[Key]> }
    : Value;

type InstallationPlan = Awaited<ReturnType<typeof planInstallation>>;
type RegistryItemInput = ReadonlyNative<InstallationPlan["items"][number]>;
type ProviderChangeInput = ReadonlyNative<
  InstallationPlan["providerChanges"][number]
>;
type PluginInput = ReadonlyNative<InstallationPlan["plugins"][number]>;

interface AddOptions {
  readonly gateway?: string;
  readonly sandboxProvider?: string;
  readonly storageProvider?: string;
  readonly storageConfig?: string;
  readonly replace?: boolean;
}
interface AddCommandOptions extends AddOptions {
  readonly cwd: string;
  readonly yes: boolean;
  readonly overwrite: boolean;
}

interface AddSetup {
  configEdit: string | undefined;
  gatewayChange: boolean;
  keepStorageOptions: boolean;
  plan: InstallationPlan;
  selectedSandbox: Awaited<ReturnType<typeof resolveSandbox>> | undefined;
  selectedGateway: Awaited<ReturnType<typeof resolveGateway>> | undefined;
  selectedStorage: Awaited<ReturnType<typeof resolveStorage>> | undefined;
}

const EMPTY_SELECTION_COUNT = 0;

const hasProviderKind = (
  metadata: unknown,
  kind: "gateway" | "storage" | "sandbox"
): boolean =>
  typeof metadata === "object" &&
  metadata !== null &&
  "kind" in metadata &&
  metadata.kind === kind;

const hasNonEmptyValue = (value: string | null | undefined): value is string =>
  typeof value === "string" && value !== "";

const selectedSandboxForPlan = async (
  cwd: string,
  plan: ReadonlyNative<InstallationPlan>,
  sandbox: Awaited<ReturnType<typeof resolveSandbox>> | undefined
) => {
  const sandboxItem = plan.items.find((item: RegistryItemInput) =>
    hasProviderKind(item.meta?.chatjs, "sandbox")
  );
  const selectedSandbox =
    sandbox ??
    (sandboxItem
      ? await resolveSandbox(plan.sources[plan.items.indexOf(sandboxItem)], cwd)
      : undefined);
  return selectedSandbox;
};

const validateAddSelection = (
  items: readonly string[],
  options: AddOptions
): void => {
  if (
    items.length === EMPTY_SELECTION_COUNT &&
    !hasNonEmptyValue(options.gateway) &&
    !hasNonEmptyValue(options.sandboxProvider) &&
    !hasNonEmptyValue(options.storageProvider)
  ) {
    throw new Error(
      "Select at least one tool, plugin, gateway, sandbox or storage provider."
    );
  }
  if (
    hasNonEmptyValue(options.storageConfig) &&
    !hasNonEmptyValue(options.storageProvider)
  ) {
    throw new Error("--storage-config requires --storage-provider.");
  }
};

const prepareAdd = async (
  cwd: string,
  items: readonly string[],
  options: AddOptions
): Promise<AddSetup> => {
  validateAddSelection(items, options);
  const sandbox = hasNonEmptyValue(options.sandboxProvider)
    ? await resolveSandbox(options.sandboxProvider, cwd)
    : undefined;
  const gateway = hasNonEmptyValue(options.gateway)
    ? await resolveGateway(options.gateway, cwd)
    : undefined;
  const storage = hasNonEmptyValue(options.storageProvider)
    ? await resolveStorage(options.storageProvider, cwd)
    : undefined;
  if (storage && hasNonEmptyValue(options.storageConfig)) {
    storage.options = parseStorageOptions(options.storageConfig);
  }
  const plan = await planInstallation(
    cwd,
    {
      plugins: [],
      gateway: gateway?.source,
      sandbox: sandbox?.source,
      storage: storage
        ? { options: storage.options, source: storage.source }
        : undefined,
      tools: items,
    },
    { replace: options.replace }
  );
  // Provider registry URLs supplied positionally still receive normal ChatJS configuration.
  const gatewayItem = plan.items.find((item: RegistryItemInput): boolean =>
    hasProviderKind(item.meta?.chatjs, "gateway")
  );
  const storageItem = plan.items.find((item: RegistryItemInput): boolean =>
    hasProviderKind(item.meta?.chatjs, "storage")
  );
  const selectedSandbox = await selectedSandboxForPlan(cwd, plan, sandbox);
  const selectedGateway =
    gateway ??
    (gatewayItem
      ? await resolveGateway(plan.sources[plan.items.indexOf(gatewayItem)], cwd)
      : undefined);
  const selectedStorage =
    storage ??
    (storageItem
      ? await resolveStorage(plan.sources[plan.items.indexOf(storageItem)], cwd)
      : undefined);
  const gatewayChange = plan.providerChanges.some(
    ({ kind, previous, next }: ProviderChangeInput) =>
      kind === "gateway" && hasNonEmptyValue(previous) && previous !== next
  );
  const keepStorageOptions =
    !hasNonEmptyValue(options.storageConfig) &&
    plan.providerChanges.some(
      ({
        kind,
        previous,
        next,
      }: ReadonlyNative<
        InstallationPlan["providerChanges"][number]
      >): boolean => kind === "storage" && previous === next
    );
  const configEdit =
    gatewayChange && selectedGateway
      ? await gatewayConfigEdit(cwd, selectedGateway)
      : undefined;

  return {
    configEdit,
    gatewayChange,
    keepStorageOptions,
    plan,
    selectedGateway,
    selectedSandbox,
    selectedStorage,
  };
};

const printSetupRequirements = (setup: ReadonlyNative<AddSetup>): void => {
  const { plan, selectedGateway, selectedStorage, selectedSandbox } = setup;
  if (plan.plugins.some((plugin: PluginInput) => plugin.id === "mcp")) {
    log.info(
      "Set MCP_ENCRYPTION_KEY before starting the app, even if no connectors are configured."
    );
  }
  const requirements = [
    ...plan.expected.flatMap(
      (item: ReadonlyNative<AddSetup["plan"]["expected"][number]>) =>
        item.envRequirements
    ),
    ...plan.plugins.flatMap(
      (plugin: PluginInput) => plugin.envRequirements ?? []
    ),
    ...(selectedGateway?.definition.envRequirements ?? []),
    ...(selectedSandbox?.definition.envRequirements ?? []),
    ...(selectedStorage?.definition.envRequirements ?? []),
  ];
  for (const requirement of requirements) {
    log.info(
      `Required: ${requirement.options.map((option: readonly string[]): string => option.join(" + ")).join(" or ")}`
    );
  }
};

export const add = new Command("add")
  .description(
    "install registry tools/plugins/providers and compose their ChatJS registrations"
  )
  .argument(
    "[items...]",
    "tool/plugin names or native shadcn registry addresses"
  )
  .option(
    "-y, --yes",
    "skip installation confirmation; does not authorize replacement/overwrite",
    false
  )
  .option("--replace", "explicitly replace an exclusive provider", false)
  .option(
    "-o, --overwrite",
    "authorize overwriting modified or untracked installed source",
    false
  )
  .option(
    "--sandbox-provider <item>",
    "install or replace optional sandbox infrastructure"
  )
  .option("--gateway <item>", "install or replace the AI gateway")
  .option("--storage-provider <item>", "install or replace file storage")
  .option("--storage-config <json>", "non-secret storage adapter options")
  .option("-c, --cwd <cwd>", "project directory", process.cwd())
  .action(
    async (
      items: readonly string[],
      options: AddCommandOptions
    ): Promise<void> => {
      try {
        const cwd = path.resolve(options.cwd);
        await access(path.join(cwd, "chat.config.ts"));
        const setup = await prepareAdd(cwd, items, options);
        const {
          plan,
          selectedGateway,
          selectedSandbox,
          selectedStorage,
          gatewayChange,
          configEdit,
          keepStorageOptions,
        } = setup;
        for (const { previous, next } of plan.replacements) {
          log.info(
            `Replace ${previous.slot ?? previous.documentKind}: ${previous.id} → ${next.id}. Retire only ${previous.id}'s source; retain unrelated installations and editable UI order.`
          );
        }
        for (const { kind, previous, next } of plan.providerChanges) {
          if (hasNonEmptyValue(previous) && previous !== next) {
            log.info(
              `Replace ${kind}: ${previous} → ${next}. Update provider source and environment requirements.`
            );
          }
        }
        if (gatewayChange) {
          log.info(
            "Preserving model IDs and other runtime configuration in chat.config.ts. Review model IDs for the new gateway, then run setup/fetch:models."
          );
        }
        if (!options.yes) {
          const answer = await confirm({
            message: `Install ${plan.sources.join(", ")}?`,
          });
          if (isCancel(answer) || !answer) {
            return;
          }
        }
        await installPlan(
          cwd,
          plan,
          {
            finalize: async (): Promise<void> => {
              const manager = inferPackageManager(cwd);
              await runCommand(manager, ["install"], cwd);
              const formatter = {
                bun: ["run"],
                npm: ["exec", "--"],
                pnpm: ["exec"],
                yarn: ["run"],
              }[manager];
              await runCommand(
                manager,
                [
                  ...formatter,
                  "oxfmt",
                  "--write",
                  "package.json",
                  ".chatjs/installed-dependencies.json",
                  ...(selectedSandbox ? ["lib/sandbox/options.ts"] : []),
                ],
                cwd
              );
            },
            managedTargets: [
              ...(selectedGateway ? ["lib/ai/gateway-model-defaults.ts"] : []),
              ...sandboxProviderTargets(selectedSandbox),
              ...(selectedStorage && !keepStorageOptions
                ? ["lib/storage-options.ts"]
                : []),
            ],
            overwrite: options.overwrite,
            rollbackTargets: [
              ...(selectedGateway ? ["lib/ai/models.generated.ts"] : []),
              ...(hasNonEmptyValue(configEdit) ? ["chat.config.ts"] : []),
              ...(selectedGateway || selectedStorage || selectedSandbox
                ? [".env.example"]
                : []),
            ],
          },
          async (): Promise<void> => {
            if (selectedSandbox) {
              await configureSandboxProvider(cwd, selectedSandbox);
            }
            if (selectedGateway) {
              await configureGatewayProvider(cwd, selectedGateway);
            }
            if (selectedStorage && !keepStorageOptions) {
              await configureStorageProvider(cwd, selectedStorage);
            }
            if (hasNonEmptyValue(configEdit)) {
              await writeFile(path.join(cwd, "chat.config.ts"), configEdit);
            }
            await syncTools(cwd, { expected: plan.expected });
            await syncPlugins(cwd, {
              addUi: plan.plugins.map((plugin: PluginInput) => plugin.id),
              expected: plan.plugins.map((plugin) => plugin.id),
            });
          }
        );
        printSetupRequirements(setup);
        if (
          plan.plugins.some(
            (plugin: PluginInput): boolean =>
              (plugin.databaseSchemas?.length ?? 0) > 0
          )
        ) {
          log.info(
            "Database schema added. Run your db:generate script and review the SQL before running setup or db:migrate."
          );
        }
        log.success(
          "Installed and registered. Review .env.local, then run setup."
        );
      } catch (error) {
        handleError(error);
      }
    }
  );
