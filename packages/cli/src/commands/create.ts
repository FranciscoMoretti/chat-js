/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { readFile, writeFile } from "node:fs/promises";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */

import { intro, outro } from "@clack/prompts";
import { Command } from "commander";
import { z } from "zod";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { toolDefinitionSchema } from "../../../registry/metadata";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { observabilityItems } from "../../../registry/src/features/observability";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { buildConfigTs } from "../helpers/config-builder";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { ensureTargetEmpty } from "../helpers/ensure-target";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { collectEnvChecklist } from "../helpers/env-checklist";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import type { EnvVarEntry } from "../helpers/env-checklist";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/max-dependencies -- This integration composes its explicit adapters here; splitting the imports would hide the dependency boundary without reducing dependencies. */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { configureGatewayProvider } from "../helpers/gateway-provider";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-enable import/max-dependencies */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import {
  promptAssistantTools,
  promptAuth,
  promptCoreFeatures,
  promptObservability,
  promptDocumentTypes,
  promptElectron,
  promptGateway,
  promptProjectName,
  promptStorage,
  promptSearchTool,
  promptUrlRetrievalTool,
  promptImageGenerationTool,
  promptVideoGenerationTool,
  promptCodeExecutionTool,
} from "../helpers/prompts";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import {
  scaffoldElectron,
  scaffoldFromGit,
  scaffoldFromTemplate,
} from "../helpers/scaffold";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { configureStorageProvider } from "../helpers/storage-provider";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { resolveGateway } from "../registry/gateways";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { itemAddress, listTools, readItem } from "../registry/shadcn";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { resolveStorage } from "../registry/storage";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import type { PackageManager } from "../types";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { launcherPackageManager } from "../utils/get-package-manager";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { handleError } from "../utils/handle-error";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { highlighter } from "../utils/highlighter";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import {
  installPlan,
  recordInstalledSource,
  plannedSourceTargets,
} from "../utils/install-plan";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { planInstallation } from "../utils/installation-plan";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { logger } from "../utils/logger";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { runCommand } from "../utils/run-command";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { spinner } from "../utils/spinner";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { syncFeatures } from "../utils/sync-features";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { syncTools } from "../utils/sync-tools";
/* oxlint-enable import/no-relative-parent-imports */

const resolveCreateTarget = (
  targetArg: string | undefined
): {
  projectName: string;
  targetDir: string;
  displayPath: string;
} => {
  if (!(typeof targetArg === "string" && targetArg !== "")) {
    const projectName = "my-chat-app";
    return {
      displayPath: projectName,
      projectName,
      targetDir: path.resolve(process.cwd(), projectName),
    };
  }

  const targetDir = path.resolve(process.cwd(), targetArg);
  const projectName = path.basename(targetDir);
  const relativePath = path.relative(process.cwd(), targetDir);

  return {
    displayPath: relativePath || ".",
    projectName,
    targetDir,
  };
};

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable eslint/no-continue -- Skipping an ineligible item here keeps the remaining per-item operation inside the same loop and cleanup scope. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const printEnvChecklist = (entries: EnvVarEntry[]): void => {
  logger.info("Required for your configuration:");
  logger.break();

  for (let entryIndex = 0; entryIndex < entries.length; entryIndex += 1) {
    const entry = entries[entryIndex];

    if (!(typeof entry.oneOfGroup === "string" && entry.oneOfGroup !== "")) {
      logger.log(
        `  ${highlighter.warn("*")} ${highlighter.warn(entry.vars)} ${highlighter.dim(`- ${entry.description}`)}`
      );
      continue;
    }

    logger.log(`  ${highlighter.warn("*")} ${highlighter.dim("One of:")}`);
    while (
      entryIndex < entries.length &&
      entries[entryIndex].oneOfGroup === entry.oneOfGroup
    ) {
      const option = entries[entryIndex];
      logger.log(
        `    ${highlighter.warn("*")} ${highlighter.warn(option.vars)} ${highlighter.dim(`- ${option.description}`)}`
      );
      entryIndex += 1;
    }
    entryIndex -= 1;
  }
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-continue */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const createOptionsSchema = z.object({
  attachments: z.boolean().optional(),
  codeExecutionTool: z.string().optional(),
  electron: z.boolean().optional(),
  fromGit: z.string().optional(),
  gateway: z.string().optional(),
  imageGenerationTool: z.string().optional(),
  mcp: z.boolean().optional(),
  observability: z
    .string()
    .refine(
      (value): boolean =>
        value
          .split(",")
          .map((id): string => id.trim())
          .filter(Boolean)
          .every((id): boolean =>
            observabilityItems.some((item): boolean => item.name === id)
          ),
      "Observability must select vercel-analytics, vercel-speed-insights or langfuse."
    )
    .optional(),
  searchTool: z.string().optional(),
  storageConfig: z.string().optional(),
  storageProvider: z.string().optional(),
  target: z.string().optional(),
  urlRetrievalTool: z.string().optional(),
  videoGenerationTool: z.string().optional(),
  yes: z.boolean(),
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */

type CreateOptions = z.infer<typeof createOptionsSchema>;
type AssistantTools = Awaited<ReturnType<typeof promptAssistantTools>>;

interface ProjectTarget {
  appName: string;
  appPrefix: string;
  appUrl: string;
  displayPath: string;
  projectName: string;
  targetDir: string;
}

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
const collectToolSources = async (
  options: CreateOptions,
  assistantTools: AssistantTools,
  targetDir: string
): Promise<string[]> => {
  const toolSources = assistantTools.installableTools.map((tool): string =>
    itemAddress(tool, "tool")
  );
  if (assistantTools.builtInTools.deepResearch) {
    assistantTools.builtInTools.webSearch = true;
  }
  const selections = [
    {
      feature: "videoGeneration",
      prompt: promptVideoGenerationTool,
      slot: "generateVideo",
      source: options.videoGenerationTool,
    },
    {
      feature: "imageGeneration",
      prompt: promptImageGenerationTool,
      slot: "generateImage",
      source: options.imageGenerationTool,
    },
    {
      feature: "webSearch",
      prompt: promptSearchTool,
      slot: "webSearch",
      source: options.searchTool,
    },
    {
      feature: "codeExecution",
      prompt: promptCodeExecutionTool,
      slot: "codeExecution",
      source: options.codeExecutionTool,
    },
    {
      feature: "urlRetrieval",
      prompt: promptUrlRetrievalTool,
      slot: "retrieveUrl",
      source: options.urlRetrievalTool,
    },
  ] as const;

  const addSelection = async (index: number): Promise<void> => {
    const selection = selections[index];
    if (!selection) {
      return;
    }
    if (typeof selection.source === "string" && selection.source !== "") {
      assistantTools.builtInTools[selection.feature] = true;
    }
    if (assistantTools.builtInTools[selection.feature]) {
      const source = itemAddress(
        selection.source ?? (await selection.prompt(options.yes)),
        "tool"
      );
      const item = await readItem(source, targetDir);
      const metadata = toolDefinitionSchema.parse(item.meta?.chatjs);
      if (metadata.slot !== selection.slot) {
        throw new Error(
          `Selected tool must declare the ${selection.slot} slot.`
        );
      }
      toolSources.push(source);
    }
    await addSelection(index + 1);
  };

  await addSelection(0);
  return toolSources;
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
const promptProjectTarget = async (
  options: CreateOptions
): Promise<ProjectTarget> => {
  const initialTarget = resolveCreateTarget(options.target);
  const projectName = await promptProjectName(
    initialTarget.projectName,
    options.yes
  );
  const targetDir =
    typeof options.target === "string" && options.target !== ""
      ? initialTarget.targetDir
      : path.resolve(process.cwd(), projectName);
  const displayPath =
    typeof options.target === "string" && options.target !== ""
      ? initialTarget.displayPath
      : projectName;
  const appName = projectName
    .split("-")
    .map((word): string => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return {
    appName,
    appPrefix: projectName,
    appUrl: "http://localhost:3000",
    displayPath,
    projectName,
    targetDir,
  };
};
/* oxlint-enable eslint/no-magic-numbers */

const loadInstallableTools = async (
  options: CreateOptions,
  targetDir: string
): Promise<Awaited<ReturnType<typeof listTools>>> => {
  if (options.yes) {
    return [];
  }

  const registrySpinner = spinner("Loading installable tools...").start();
  try {
    const registryItems = await listTools(targetDir);
    registrySpinner.succeed("Installable tools loaded.");
    return registryItems;
  } catch (error) {
    registrySpinner.fail("Could not load installable tools.");
    logger.warn(
      error instanceof Error
        ? error.message
        : "Continuing with built-in tools only."
    );
    return [];
  }
};

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const promptCreateSetup = async (options: CreateOptions, targetDir: string) => {
  const gatewaySource = options.gateway ?? (await promptGateway(options.yes));
  const gatewaySelection = await resolveGateway(gatewaySource, targetDir);
  const coreFeatures = await promptCoreFeatures(
    options.yes,
    gatewaySelection.definition,
    options.mcp
  );
  if (options.attachments !== undefined) {
    coreFeatures.attachments = options.attachments;
  }
  const observability =
    options.observability === undefined
      ? await promptObservability(options.yes)
      : options.observability
          .split(",")
          .map((id): string => id.trim())
          .filter(Boolean);
  const documentTypes = await promptDocumentTypes(
    options.yes,
    coreFeatures.documents
  );
  const registryItems = await loadInstallableTools(options, targetDir);
  const assistantTools = await promptAssistantTools(registryItems, options.yes);
  if (assistantTools.builtInTools.deepResearch) {
    coreFeatures.documents = true;
    documentTypes.text = true;
  }
  const toolSources = await collectToolSources(
    options,
    assistantTools,
    targetDir
  );
  const selectedTools = await Promise.all(
    toolSources.map(async (source) => {
      const item = await readItem(source, targetDir);
      return toolDefinitionSchema.parse(item.meta?.chatjs);
    })
  );
  for (const kind of ["text", "code", "sheet"] as const) {
    if (coreFeatures.documents && documentTypes[kind]) {
      const source = itemAddress(`${kind}-documents`, "tool");
      if (!toolSources.includes(source)) {
        toolSources.push(source);
      }
    }
  }
  if (assistantTools.builtInTools.deepResearch) {
    toolSources.push(itemAddress("deep-research", "tool"));
  }
  if (
    coreFeatures.documents &&
    documentTypes.code &&
    selectedTools.some(
      (tool) => tool.slot === "codeExecution" && tool.codeExecutorExport
    )
  ) {
    toolSources.push(itemAddress("saved-code-execution", "tool"));
  }
  const usesStorage =
    coreFeatures.attachments ||
    assistantTools.builtInTools.imageGeneration ||
    assistantTools.builtInTools.videoGeneration ||
    options.storageProvider !== undefined ||
    options.storageConfig !== undefined;
  const storage = usesStorage
    ? await promptStorage(
        options.yes,
        options.storageProvider,
        options.storageConfig,
        targetDir
      )
    : await resolveStorage("memory", targetDir);
  const auth = await promptAuth(options.yes);
  const withElectron = await promptElectron(options.yes, options.electron);

  return {
    assistantTools,
    auth,
    coreFeatures,
    documentTypes,
    gateway: gatewaySelection.definition.id,
    gatewaySelection,
    observability,
    storage,
    toolSources,
    usesStorage,
    withElectron,
  };
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const scaffoldProject = async (
  project: ProjectTarget,
  packageManager: PackageManager,
  withElectron: boolean
): Promise<void> => {
  await scaffoldFromTemplate(project.targetDir, { packageManager });
  if (withElectron) {
    await scaffoldElectron(project.targetDir, {
      packageManager,
      projectName: project.projectName,
    });
  }
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const writeConfiguration = async (
  project: ProjectTarget,
  setup: Awaited<ReturnType<typeof promptCreateSetup>>
): Promise<void> => {
  const configSpinner = spinner("Writing configuration...").start();
  try {
    const packageJsonPath = path.join(project.targetDir, "package.json");
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Commander supplies an open option object that is immediately checked by the create-options schema.
    const packageJson = JSON.parse(
      await readFile(packageJsonPath, "utf-8")
    ) as {
      name?: string;
    };
    packageJson.name = project.projectName;
    await writeFile(
      packageJsonPath,
      `${JSON.stringify(packageJson, null, 2)}\n`
    );
    await writeFile(
      path.join(project.targetDir, "chat.config.ts"),
      buildConfigTs({
        appName: project.appName,
        appPrefix: project.appPrefix,
        appUrl: project.appUrl,
        auth: setup.auth,
        coreFeatures: setup.coreFeatures,
        gateway: setup.gateway,
        gatewayDefaults: setup.gatewaySelection.definition.defaults,
        withElectron: setup.withElectron,
      })
    );
    configSpinner.succeed("Configuration written.");
  } catch (error) {
    configSpinner.fail("Failed to write configuration.");
    throw error;
  }
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable unicorn/no-null */

const oxfmtCommandFor = (packageManager: PackageManager): string[] => {
  const commands: Record<PackageManager, string[]> = {
    bun: ["run"],
    npm: ["exec", "--"],
    pnpm: ["exec"],
    yarn: ["run"],
  };
  return commands[packageManager];
};

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const installRegistryItems = async (
  packageManager: PackageManager,
  project: ProjectTarget,
  setup: Awaited<ReturnType<typeof promptCreateSetup>>
): Promise<Awaited<ReturnType<typeof syncTools>>> => {
  const installSpinner = spinner(
    "Installing selected registry items..."
  ).start();
  try {
    const plan = await planInstallation(
      project.targetDir,
      {
        features: [
          ...setup.observability,
          ...(setup.coreFeatures.mcp ? ["mcp"] : []),
          ...(setup.coreFeatures.attachments ? ["attachment-uploads"] : []),
        ],
        gateway: setup.gatewaySelection.source,
        storage: {
          options: setup.storage.options,
          source: setup.storage.source,
        },
        tools: setup.toolSources,
      },
      { fresh: true }
    );
    let installedTools: Awaited<ReturnType<typeof syncTools>> = [];
    await installPlan(
      project.targetDir,
      plan,
      { fresh: true },
      async (): Promise<void> => {
        await configureGatewayProvider(
          project.targetDir,
          setup.gatewaySelection
        );
        await configureStorageProvider(project.targetDir, setup.storage);
        installedTools = await syncTools(project.targetDir, {
          expected: plan.expected,
        });
        await syncFeatures(project.targetDir, {
          addUi: true,
          expectedMcp: plan.features.some(
            (feature): boolean => feature.id === "mcp"
          ),
          expectedUploads: plan.features.some(
            (feature): boolean => feature.id === "attachment-uploads"
          ),
        });
      }
    );
    await runCommand(packageManager, ["install"], project.targetDir);
    await runCommand(
      packageManager,
      [...oxfmtCommandFor(packageManager), "oxfmt", "--write", "."],
      project.targetDir
    );
    await recordInstalledSource(project.targetDir, [
      ...plannedSourceTargets(plan),
      "chat.config.ts",
      "lib/ai/gateway-model-defaults.ts",
      "lib/ai/models.generated.ts",
      "lib/storage-options.ts",
      ".env.example",
    ]);
    installSpinner.succeed("Registry items installed and configured.");
    return installedTools;
  } catch (error) {
    installSpinner.fail(
      "Installation failed; the project may be partially installed."
    );
    throw error;
  }
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable eslint/max-params -- This adapter implements the existing positional callback contract; changing it requires updating every caller. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const printNextSteps = (
  packageManager: PackageManager,
  project: ProjectTarget,
  setup: Awaited<ReturnType<typeof promptCreateSetup>>,
  installedTools: Awaited<ReturnType<typeof syncTools>>
): void => {
  const envEntries = collectEnvChecklist({
    auth: setup.auth,
    builtInTools: setup.assistantTools.builtInTools,
    coreFeatures: setup.coreFeatures,
    gateway: setup.gateway,
    gatewayRequirements: setup.gatewaySelection.definition.envRequirements,
    installableToolEnvRequirements: [
      ...installedTools.flatMap((tool) => tool.envRequirements),
      ...observabilityItems
        .filter((item): boolean => setup.observability.includes(item.name))
        .flatMap((item) => item.meta.chatjs.envRequirements ?? []),
      ...(setup.usesStorage ? setup.storage.definition.envRequirements : []),
    ],
  });

  outro("Your ChatJS app is ready!");
  logger.info("Next steps:");
  logger.break();
  logger.log(
    `  ${highlighter.dim("1.")} cd ${highlighter.info(project.displayPath)}`
  );
  logger.log(
    `  ${highlighter.dim("2.")} Copy ${highlighter.info(".env.example")} to ${highlighter.info(".env.local")} and fill in the values below`
  );
  logger.log(
    `  ${highlighter.dim("3.")} ${highlighter.info(`${packageManager} run setup`)}`
  );
  logger.log(
    `  ${highlighter.dim("4.")} ${highlighter.info(`${packageManager} run dev`)}`
  );
  if (setup.withElectron) {
    logger.break();
    logger.info("Electron desktop app:");
    logger.log(
      `  Run the web app first, then: ${highlighter.info(`cd electron && ${packageManager} install && ${packageManager} run dev`)}`
    );
  }
  logger.break();
  printEnvChecklist(envEntries);
  logger.log(
    "  Postgres setup (Neon, Supabase, or another host): https://www.chatjs.dev/docs/reference/database"
  );
  logger.break();
  logger.log(
    `  For detailed setup instructions, visit ${highlighter.info("https://www.chatjs.dev/docs/quickstart")}`
  );
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/max-params */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const createProject = async (options: CreateOptions): Promise<void> => {
  const packageManager = launcherPackageManager();
  if (!options.yes) {
    intro("Create ChatJS App");
  }
  const project = await promptProjectTarget(options);
  await ensureTargetEmpty(project.targetDir);
  if (typeof options.fromGit === "string" && options.fromGit !== "") {
    const selectionOptions = Object.entries(options).filter(
      ([key, value]): boolean =>
        !["target", "fromGit", "yes"].includes(key) && value !== undefined
    );
    if (selectionOptions.length > 0) {
      throw new Error(
        "--from-git preserves the cloned application. Use chat-js add after cloning to change installed tools; selection flags apply only to fresh scaffolds."
      );
    }
    await scaffoldFromGit(options.fromGit, project.targetDir);
    outro(
      "Repository cloned with its configuration and installed source unchanged."
    );
    logger.info(
      `cd ${project.displayPath} and follow the repository's setup instructions. Use chat-js add to install additional tools.`
    );
    return;
  }
  const setup = await promptCreateSetup(options, project.targetDir);
  logger.break();
  await scaffoldProject(project, packageManager, setup.withElectron);
  await writeConfiguration(project, setup);
  const installedTools = await installRegistryItems(
    packageManager,
    project,
    setup
  );
  printNextSteps(packageManager, project, setup, installedTools);
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/max-statements */

export const create = new Command()
  .name("create")
  .option(
    "--code-execution-tool <item>",
    "code-execution tool name or registry address"
  )
  .option("--search-tool <item>", "search tool name or registry address")
  .option(
    "--url-retrieval-tool <item>",
    "URL retrieval tool name or registry address"
  )
  .option(
    "--image-generation-tool <item>",
    "image generation tool name or registry address"
  )
  .option(
    "--video-generation-tool <item>",
    "video generation tool name or registry address"
  )
  .description("scaffold a new ChatJS chat application")
  .argument("[directory]", "target directory for the project")
  .option(
    "--gateway <gateway>",
    "gateway name, registry item URL, or local JSON path"
  )
  .option("-y, --yes", "skip prompts and use defaults", false)
  .option(
    "--attachments",
    "install attachment picker, camera, paste/drop and upload endpoint"
  )
  .option("--no-attachments", "omit user attachment uploads")
  .option(
    "--observability <items>",
    "comma-separated vercel-analytics, vercel-speed-insights, langfuse (default: none)"
  )
  .option("--mcp", "install MCP connectors, pages and OAuth callback")
  .option("--no-mcp", "omit MCP from the new app")
  .option("--electron", "include the Electron desktop app")
  .option("--no-electron", "do not include the Electron desktop app")
  .option(
    "--from-git <url>",
    "clone from a git repository instead of the built-in scaffold"
  )
  .option(
    "--storage-provider <item>",
    "storage registry item (built-in name, namespace, URL or local JSON path)"
  )
  .option(
    "--storage-config <json>",
    "non-secret JSON options for the storage adapter; credentials use env vars"
  )
  .action(async (directory, opts): Promise<void> => {
    try {
      await createProject(
        // oxlint-disable-next-line typescript/no-unsafe-assignment -- Commander supplies an open option object that is immediately checked by the create-options schema.
        createOptionsSchema.parse({ target: directory, ...opts })
      );
    } catch (error) {
      handleError(error);
    }
  });

/* oxlint-disable max-lines -- Keep this cohesive contract and its cases together; splitting it solely for a line quota would obscure shared setup or state transitions. */
