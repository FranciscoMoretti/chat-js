// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI reads, writes, and validates real project files with native filesystem APIs.
import { readFile, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI resolves platform-specific project and installation paths.
import path from "node:path";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { intro, outro } from "@clack/prompts";
/* oxlint-enable sort-imports */
import { Command } from "commander";
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { buildConfigTs } from "#cli/helpers/config-builder";
/* oxlint-enable sort-imports */
import { ensureTargetEmpty } from "#cli/helpers/ensure-target";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { EnvVarEntry } from "#cli/helpers/env-checklist";
/* oxlint-enable sort-imports */
import { collectEnvChecklist } from "#cli/helpers/env-checklist";
import { configureGatewayProvider } from "#cli/helpers/gateway-provider";
import { parseJsonObject } from "#cli/helpers/json-object";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  promptAssistantTools,
  promptAuth,
  promptCodeExecutionTool,
  promptCoreFeatures,
  promptDocumentTypes,
  promptElectron,
  promptGateway,
  promptImageGenerationTool,
  promptObservability,
  promptProjectName,
  promptSearchTool,
  promptStorage,
  promptUrlRetrievalTool,
  promptVideoGenerationTool,
  // oxlint-disable-next-line import/max-dependencies -- The creation command composes validation, prompts, source scaffolding, registry planning, configuration writing, and process installation directly.
} from "#cli/helpers/prompts";
/* oxlint-enable sort-imports */
import type { ReadonlyInput } from "#cli/helpers/readonly-input";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import {
  scaffoldElectron,
  scaffoldFromGit,
  scaffoldFromTemplate,
} from "#cli/helpers/scaffold";
/* oxlint-enable sort-imports */
import { configureStorageProvider } from "#cli/helpers/storage-provider";
import { resolveGateway } from "#cli/registry/gateways";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { itemAddress, listTools, readItem } from "#cli/registry/shadcn";
/* oxlint-enable sort-imports */
import { resolveStorage } from "#cli/registry/storage";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { PackageManager } from "#cli/types";
/* oxlint-enable sort-imports */
import { launcherPackageManager } from "#cli/utils/get-package-manager";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { handleError } from "#cli/utils/handle-error";
/* oxlint-enable sort-imports */
import { highlighter } from "#cli/utils/highlighter";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  installPlan,
  plannedSourceTargets,
  recordInstalledSource,
} from "#cli/utils/install-plan";
/* oxlint-enable sort-imports */
import { planInstallation } from "#cli/utils/installation-plan";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { logger } from "#cli/utils/logger";
/* oxlint-enable sort-imports */
import { runCommand } from "#cli/utils/run-command";
import { spinner } from "#cli/utils/spinner";
import { syncFeatures } from "#cli/utils/sync-features";
import { syncTools } from "#cli/utils/sync-tools";

// oxlint-disable-next-line import/no-relative-parent-imports -- This shared registry or app schema is outside the CLI package and is bundled into its published executable.
import { toolDefinitionSchema } from "../../../registry/metadata";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
// oxlint-disable-next-line import/no-relative-parent-imports -- This shared registry or app schema is outside the CLI package and is bundled into its published executable.
import { observabilityItems } from "../../../registry/src/features/observability";
/* oxlint-enable sort-imports */

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
const printEnvChecklist = (entries: readonly Readonly<EnvVarEntry>[]): void => {
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
/* oxlint-enable eslint/no-continue */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-statements */

const createOptionsSchema = z.object({
  attachments: z.boolean().optional(),
  codeExecutionTool: z.string().optional(),
  documents: z.boolean().optional(),
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
            observabilityItems.some(
              (
                item: ReadonlyInput<(typeof observabilityItems)[number]>
              ): boolean => item.name === id
            )
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

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve collectToolSources's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
const collectToolSources = async (
  options: Readonly<CreateOptions>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Selection resolves deep research dependencies and explicit provider choices by updating the shared builtInTools flags consumed by configuration writing.
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
    if (index >= selections.length) {
      return;
    }
    const selection = selections[index];
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve promptProjectTarget's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
const promptProjectTarget = async (
  options: Readonly<CreateOptions>
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve loadInstallableTools's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable eslint/no-magic-numbers */

const loadInstallableTools = async (
  options: Readonly<CreateOptions>,
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve promptCreateSetup's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
// oxlint-disable-next-line eslint/complexity -- The installation matrix branches on explicit independent selections at this orchestration boundary.
const promptCreateSetup = async (
  options: Readonly<CreateOptions>,
  targetDir: string
) => {
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
  coreFeatures.documents = options.documents ?? coreFeatures.documents;
  const documentTypes = await promptDocumentTypes(
    options.yes,
    coreFeatures.documents
  );
  const registryItems = await loadInstallableTools(options, targetDir);
  const assistantTools = await promptAssistantTools(
    registryItems,
    options.yes,
    gatewaySelection.definition
  );
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
      (tool: ReadonlyInput<z.output<typeof toolDefinitionSchema>>) =>
        tool.slot === "codeExecution" &&
        typeof tool.codeExecutorExport === "string" &&
        tool.codeExecutorExport !== ""
    )
  ) {
    toolSources.push(itemAddress("saved-code-execution", "tool"));
  }
  const usesStorage =
    coreFeatures.attachments ||
    selectedTools.some(
      (tool: ReadonlyInput<z.output<typeof toolDefinitionSchema>>) =>
        tool.requiresStorage === true
    ) ||
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

  const plan = await planInstallation(
    targetDir,
    {
      features: [
        ...observability,
        ...(coreFeatures.mcp ? ["mcp"] : []),
        ...(coreFeatures.attachments ? ["attachment-uploads"] : []),
      ],
      gateway: gatewaySelection.source,
      storage: {
        options: storage.options,
        source: storage.source,
      },
      tools: toolSources,
    },
    { documents: options.documents, fresh: true }
  );

  return {
    assistantTools,
    auth,
    coreFeatures,
    documentTypes,
    gateway: gatewaySelection.definition.id,
    gatewaySelection,
    observability,
    plan,
    storage,
    usesStorage,
    withElectron,
  };
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve scaffoldProject's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

const scaffoldProject = async (
  project: Readonly<ProjectTarget>,
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve writeConfiguration's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
const writeConfiguration = async (
  project: Readonly<ProjectTarget>,
  setup: ReadonlyInput<Awaited<ReturnType<typeof promptCreateSetup>>>
): Promise<void> => {
  const configSpinner = spinner("Writing configuration...").start();
  try {
    const packageJsonPath = path.join(project.targetDir, "package.json");
    const packageJson = parseJsonObject(
      await readFile(packageJsonPath, "utf-8"),
      "Scaffold package.json"
    );
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
/* oxlint-enable oxc/no-async-await */
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

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve installRegistryItems's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
const installRegistryItems = async (
  packageManager: PackageManager,
  project: Readonly<ProjectTarget>,
  setup: ReadonlyInput<Awaited<ReturnType<typeof promptCreateSetup>>>
): Promise<Awaited<ReturnType<typeof syncTools>>> => {
  const installSpinner = spinner(
    "Installing selected registry items..."
  ).start();
  try {
    const { plan } = setup;
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
      [
        ...oxfmtCommandFor(packageManager),
        "oxfmt",
        "--write",
        ".",
        "package.json",
        ".chatjs/installed-dependencies.json",
      ],
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable eslint/max-params -- This adapter implements the existing positional callback contract; changing it requires updating every caller. */
const printNextSteps = (
  packageManager: PackageManager,
  project: Readonly<ProjectTarget>,
  setup: ReadonlyInput<Awaited<ReturnType<typeof promptCreateSetup>>>,
  installedTools: ReadonlyInput<Awaited<ReturnType<typeof syncTools>>>
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
        .filter(
          (item: ReadonlyInput<(typeof observabilityItems)[number]>): boolean =>
            setup.observability.includes(item.name)
        )
        .flatMap(
          (item: ReadonlyInput<(typeof observabilityItems)[number]>) =>
            item.meta.chatjs.envRequirements ?? []
        ),
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
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve createProject's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable eslint/max-params */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
const createProject = async (
  options: Readonly<CreateOptions>
): Promise<void> => {
  const packageManager = launcherPackageManager();
  if (!options.yes) {
    intro("Create ChatJS App");
  }
  const project = await promptProjectTarget(options);
  await ensureTargetEmpty(project.targetDir);
  if (typeof options.fromGit === "string" && options.fromGit !== "") {
    const selectionOptions = Object.entries(options).filter(
      ([key, value]: readonly [string, unknown]): boolean =>
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve create's awaited sequencing and rejected-Promise behavior. */
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
  .option("--documents", "install text, code and sheet documents")
  .option("--no-documents", "omit document tools from the new app")
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
  .action(
    async (
      directory: unknown,
      opts: Readonly<Record<string, unknown>>
    ): Promise<void> => {
      try {
        await createProject(
          createOptionsSchema.parse({ target: directory, ...opts })
        );
      } catch (error) {
        handleError(error);
      }
    }
  );
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable max-lines -- Keep this cohesive contract and its cases together; splitting it solely for a line quota would obscure shared setup or state transitions. */
