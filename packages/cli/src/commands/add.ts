import { access, writeFile } from "node:fs/promises";
import path from "node:path";

import { confirm, isCancel, log } from "@clack/prompts";
import { Command } from "commander";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { configureGatewayProvider } from "../helpers/gateway-provider";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import {
  parseStorageOptions,
  configureStorageProvider,
} from "../helpers/storage-provider";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { resolveGateway } from "../registry/gateways";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { resolveStorage } from "../registry/storage";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { handleError } from "../utils/handle-error";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { installPlan } from "../utils/install-plan";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/max-dependencies -- This integration composes its explicit adapters here; splitting the imports would hide the dependency boundary without reducing dependencies. */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { planInstallation } from "../utils/installation-plan";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-enable import/max-dependencies */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { gatewayConfigEdit } from "../utils/provider-config";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import {
  assertSupportedFeatureInstallation,
  syncFeatures,
} from "../utils/sync-features";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { syncTools } from "../utils/sync-tools";
/* oxlint-enable import/no-relative-parent-imports */

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
type FeatureInput = ReadonlyNative<InstallationPlan["features"][number]>;

interface AddOptions {
  readonly gateway?: string;
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
  selectedGateway: Awaited<ReturnType<typeof resolveGateway>> | undefined;
  selectedStorage: Awaited<ReturnType<typeof resolveStorage>> | undefined;
}

const EMPTY_SELECTION_COUNT = 0;

const hasProviderKind = (
  metadata: unknown,
  kind: "gateway" | "storage"
): boolean =>
  typeof metadata === "object" &&
  metadata !== null &&
  "kind" in metadata &&
  metadata.kind === kind;

const hasNonEmptyValue = (value: string | null | undefined): value is string =>
  typeof value === "string" && value !== "";

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
const prepareAdd = async (
  cwd: string,
  items: readonly string[],
  options: AddOptions
): Promise<AddSetup> => {
  if (
    items.length === EMPTY_SELECTION_COUNT &&
    !hasNonEmptyValue(options.gateway) &&
    !hasNonEmptyValue(options.storageProvider)
  ) {
    throw new Error(
      "Select at least one tool, feature, gateway or storage provider."
    );
  }
  if (
    hasNonEmptyValue(options.storageConfig) &&
    !hasNonEmptyValue(options.storageProvider)
  ) {
    throw new Error("--storage-config requires --storage-provider.");
  }
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
      features: [],
      gateway: gateway?.source,
      storage: storage
        ? { options: storage.options, source: storage.source }
        : undefined,
      tools: items,
    },
    { replace: options.replace }
  );
  assertSupportedFeatureInstallation(plan.features);
  // Provider registry URLs supplied positionally still receive normal ChatJS configuration.
  const gatewayItem = plan.items.find((item: RegistryItemInput): boolean =>
    hasProviderKind(item.meta?.chatjs, "gateway")
  );
  const storageItem = plan.items.find((item: RegistryItemInput): boolean =>
    hasProviderKind(item.meta?.chatjs, "storage")
  );
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
      kind === "gateway" && previous && previous !== next
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
    selectedStorage,
  };
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

const printSetupRequirements = (setup: ReadonlyNative<AddSetup>): void => {
  const { plan, selectedGateway, selectedStorage } = setup;
  if (plan.features.some((feature: FeatureInput) => feature.id === "mcp")) {
    log.info(
      "Set MCP_ENCRYPTION_KEY before starting the app, even if no connectors are configured."
    );
  }
  const requirements = [
    ...plan.expected.flatMap(
      (item: ReadonlyNative<AddSetup["plan"]["expected"][number]>) =>
        item.envRequirements
    ),
    ...plan.features.flatMap(
      (feature: FeatureInput) => feature.envRequirements ?? []
    ),
    ...(selectedGateway?.definition.envRequirements ?? []),
    ...(selectedStorage?.definition.envRequirements ?? []),
  ];
  for (const requirement of requirements) {
    log.info(
      `Required: ${requirement.options.map((option: readonly string[]): string => option.join(" + ")).join(" or ")}`
    );
  }
};

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
export const add = new Command("add")
  .description(
    "install registry tools/features/providers and compose their ChatJS registrations"
  )
  .argument(
    "[items...]",
    "tool/feature names or native shadcn registry addresses"
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
            managedTargets: [
              ...(selectedGateway ? ["lib/ai/gateway-model-defaults.ts"] : []),
              ...(selectedStorage && !keepStorageOptions
                ? ["lib/storage-options.ts", ".env.example"]
                : []),
            ],
            overwrite: options.overwrite,
            rollbackTargets: [
              ...(selectedGateway ? ["lib/ai/models.generated.ts"] : []),
              ...(hasNonEmptyValue(configEdit) ? ["chat.config.ts"] : []),
              ...(selectedGateway || selectedStorage ? [".env.example"] : []),
            ],
          },
          async (): Promise<void> => {
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
            await syncFeatures(cwd, {
              addUi: plan.features.map((feature: FeatureInput) => feature.id),
              expectedMcp: plan.features.some(
                (feature: FeatureInput) => feature.id === "mcp"
              ),
              expectedUploads: plan.features.some(
                (feature: FeatureInput) => feature.id === "attachment-uploads"
              ),
            });
          }
        );
        printSetupRequirements(setup);
        log.success(
          "Installed and registered. Review .env.local, then run setup."
        );
      } catch (error) {
        handleError(error);
      }
    }
  );
