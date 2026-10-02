import { access, writeFile } from "node:fs/promises";
import path from "node:path";

import { confirm, isCancel, log } from "@clack/prompts";
import { Command } from "commander";

import { configureGatewayProvider } from "../helpers/gateway-provider";
import {
  parseStorageOptions,
  configureStorageProvider,
} from "../helpers/storage-provider";
import { resolveGateway } from "../registry/gateways";
import { resolveStorage } from "../registry/storage";
import { handleError } from "../utils/handle-error";
import { installPlan } from "../utils/install-plan";
import { planInstallation } from "../utils/installation-plan";
import { gatewayConfigEdit } from "../utils/provider-config";
import {
  assertSupportedFeatureInstallation,
  syncFeatures,
} from "../utils/sync-features";
import { syncTools } from "../utils/sync-tools";

const prepareAdd = async (
  cwd: string,
  items: string[],
  options: {
    gateway?: string;
    storageProvider?: string;
    storageConfig?: string;
    replace?: boolean;
  }
) => {
  if (!items.length && !options.gateway && !options.storageProvider) {
    throw new Error(
      "Select at least one tool, feature, gateway or storage provider."
    );
  }
  if (options.storageConfig && !options.storageProvider) {
    throw new Error("--storage-config requires --storage-provider.");
  }
  const gateway = options.gateway
    ? await resolveGateway(options.gateway, cwd)
    : undefined;
  const storage = options.storageProvider
    ? await resolveStorage(options.storageProvider, cwd)
    : undefined;
  if (storage && options.storageConfig) {
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
  const gatewayItem = plan.items.find(
    (item) => item.meta?.chatjs?.kind === "gateway"
  );
  const storageItem = plan.items.find(
    (item) => item.meta?.chatjs?.kind === "storage"
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
    ({ kind, previous, next }) =>
      kind === "gateway" && previous && previous !== next
  );
  const keepStorageOptions =
    !options.storageConfig &&
    plan.providerChanges.some(
      ({ kind, previous, next }) => kind === "storage" && previous === next
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

const printSetupRequirements = (
  setup: Awaited<ReturnType<typeof prepareAdd>>
) => {
  const { plan, selectedGateway, selectedStorage } = setup;
  if (plan.features.some((feature) => feature.id === "mcp")) {
    log.info(
      "Set MCP_ENCRYPTION_KEY before starting the app, even if no connectors are configured."
    );
  }
  const requirements = [
    ...plan.expected.flatMap((item) => item.envRequirements),
    ...plan.features.flatMap((feature) => feature.envRequirements ?? []),
    ...(selectedGateway?.definition.envRequirements ?? []),
    ...(selectedStorage?.definition.envRequirements ?? []),
  ];
  for (const requirement of requirements) {
    log.info(
      `Required: ${requirement.options.map((option) => option.join(" + ")).join(" or ")}`
    );
  }
};

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
  .action(async (items: string[], options) => {
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
        if (previous && previous !== next) {
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
            ...(configEdit ? ["chat.config.ts"] : []),
            ...(selectedGateway || selectedStorage ? [".env.example"] : []),
          ],
        },
        async () => {
          if (selectedGateway) {
            await configureGatewayProvider(cwd, selectedGateway);
          }
          if (selectedStorage && !keepStorageOptions) {
            await configureStorageProvider(cwd, selectedStorage);
          }
          if (configEdit) {
            await writeFile(path.join(cwd, "chat.config.ts"), configEdit);
          }
          await syncTools(cwd, { expected: plan.expected });
          await syncFeatures(cwd, {
            addUi: plan.features.map((feature) => feature.id),
            expectedMcp: plan.features.some((feature) => feature.id === "mcp"),
            expectedUploads: plan.features.some(
              (feature) => feature.id === "attachment-uploads"
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
  });
