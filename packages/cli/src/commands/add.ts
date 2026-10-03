/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { access, writeFile } from "node:fs/promises";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { confirm, isCancel, log } from "@clack/prompts";
/* oxlint-enable eslint/sort-imports */
import { Command } from "commander";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { configureGatewayProvider } from "../helpers/gateway-provider";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import {
  parseStorageOptions,
  configureStorageProvider,
} from "../helpers/storage-provider";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { resolveGateway } from "../registry/gateways";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { resolveStorage } from "../registry/storage";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { handleError } from "../utils/handle-error";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { installPlan } from "../utils/install-plan";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/max-dependencies -- This integration composes its explicit adapters here; splitting the imports would hide the dependency boundary without reducing dependencies. */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { planInstallation } from "../utils/installation-plan";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-enable import/max-dependencies */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { gatewayConfigEdit } from "../utils/provider-config";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import {
  assertSupportedFeatureInstallation,
  syncFeatures,
} from "../utils/sync-features";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { syncTools } from "../utils/sync-tools";
/* oxlint-enable import/no-relative-parent-imports */

const hasNonEmptyValue = (value: string | null | undefined): value is string =>
  typeof value === "string" && value !== "";

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
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
  if (
    items.length === 0 &&
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
  const gatewayItem = plan.items.find(
    // oxlint-disable-next-line typescript/no-unsafe-member-access -- Shadcn metadata is an open JSON extension point; preserve third-party fields while inspecting the ChatJS discriminator rather than impose a new stripping schema.
    (item): boolean => item.meta?.chatjs?.kind === "gateway"
  );
  const storageItem = plan.items.find(
    // oxlint-disable-next-line typescript/no-unsafe-member-access -- Shadcn metadata is an open JSON extension point; preserve third-party fields while inspecting the ChatJS discriminator rather than impose a new stripping schema.
    (item): boolean => item.meta?.chatjs?.kind === "storage"
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
    !hasNonEmptyValue(options.storageConfig) &&
    plan.providerChanges.some(
      ({ kind, previous, next }): boolean =>
        kind === "storage" && previous === next
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const printSetupRequirements = (
  setup: Awaited<ReturnType<typeof prepareAdd>>
): void => {
  const { plan, selectedGateway, selectedStorage } = setup;
  if (plan.features.some((feature): boolean => feature.id === "mcp")) {
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
      `Required: ${requirement.options.map((option): string => option.join(" + ")).join(" or ")}`
    );
  }
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable oxc/no-optional-chaining */

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
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
      items: string[],
      options: Parameters<typeof prepareAdd>[2] & {
        cwd: string;
        yes: boolean;
        overwrite: boolean;
      }
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
              addUi: plan.features.map((feature) => feature.id),
              expectedMcp: plan.features.some(
                (feature): boolean => feature.id === "mcp"
              ),
              expectedUploads: plan.features.some(
                (feature): boolean => feature.id === "attachment-uploads"
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-enable oxc/no-async-await */

/* oxlint-enable import/no-named-export */

/* oxlint-enable import/prefer-default-export */
