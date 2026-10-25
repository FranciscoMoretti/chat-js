import { generateBaseline } from "#cli/utils/generate-baseline";
import { planSandboxInstallation } from "#cli/helpers/sandbox-installation";
import { configureSandboxProvider } from "#cli/helpers/sandbox-provider";
import type { resolveSandbox } from "#cli/registry/sandboxes";
import {
  installPlan,
  plannedSourceTargets,
  recordInstalledSource,
} from "#cli/utils/install-plan";
import { intro, outro } from "@clack/prompts";
import { itemAddress, listTools, readItem } from "#cli/registry/shadcn";
import {
  promptAssistantTools,
  promptAuth,
  promptCodeExecutionTool,
  promptSandbox,
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
} from "#cli/helpers/prompts";
import { readFile, writeFile } from "node:fs/promises";
import {
  scaffoldElectron,
  scaffoldFromGit,
  scaffoldFromTemplate,
} from "#cli/helpers/scaffold";
import { Command } from "commander";
import type { EnvVarEntry } from "#cli/helpers/env-checklist";
import type { PackageManager } from "#cli/types";
import type { ReadonlyInput } from "#cli/helpers/readonly-input";
import { buildConfigTs } from "#cli/helpers/config-builder";
import { collectEnvChecklist } from "#cli/helpers/env-checklist";
import { configureGatewayProvider } from "#cli/helpers/gateway-provider";
import { configureStorageProvider } from "#cli/helpers/storage-provider";
import { ensureTargetEmpty } from "#cli/helpers/ensure-target";
import { handleError } from "#cli/utils/handle-error";
import { highlighter } from "#cli/utils/highlighter";
import { launcherPackageManager } from "#cli/utils/get-package-manager";
import { logger } from "#cli/utils/logger";
import { observabilityItems } from "../../../registry/src/plugins/observability";
import { parseJsonObject } from "#cli/helpers/json-object";
import path from "node:path";
import type { planInstallation } from "#cli/utils/installation-plan";
import { resolveGateway } from "#cli/registry/gateways";
import { resolveStorage } from "#cli/registry/storage";
import { runCommand } from "#cli/utils/run-command";
import { spinner } from "#cli/utils/spinner";
import { syncPlugins } from "#cli/utils/sync-plugins";
import { syncTools } from "#cli/utils/sync-tools";
import { toolDefinitionSchema } from "../../../registry/metadata";
import { z } from "zod";

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

const NEXT_ENTRY = 1;
const FIRST_ENTRY = 0;
const JSON_INDENT = 2;
const FIRST_CHARACTER = 0;
const NEXT_CHARACTER = 1;
const EMPTY_SELECTION_COUNT = 0;

const printEnvGroup = (
  entries: readonly Readonly<EnvVarEntry>[],
  entry: Readonly<EnvVarEntry>,
  firstIndex: number
): number => {
  logger.log(`  ${highlighter.warn("*")} ${highlighter.dim("One of:")}`);
  let entryIndex = firstIndex;
  while (
    entryIndex < entries.length &&
    entries[entryIndex].oneOfGroup === entry.oneOfGroup
  ) {
    const option = entries[entryIndex];
    logger.log(
      `    ${highlighter.warn("*")} ${highlighter.warn(option.vars)} ${highlighter.dim(`- ${option.description}`)}`
    );
    entryIndex += NEXT_ENTRY;
  }
  return entryIndex - NEXT_ENTRY;
};

const printEnvChecklist = (entries: readonly Readonly<EnvVarEntry>[]): void => {
  logger.info("Required for your configuration:");
  logger.break();
  for (
    let entryIndex = FIRST_ENTRY;
    entryIndex < entries.length;
    entryIndex += NEXT_ENTRY
  ) {
    const entry = entries[entryIndex];
    if (typeof entry.oneOfGroup === "string" && entry.oneOfGroup !== "") {
      entryIndex = printEnvGroup(entries, entry, entryIndex);
    } else {
      logger.log(
        `  ${highlighter.warn("*")} ${highlighter.warn(entry.vars)} ${highlighter.dim(`- ${entry.description}`)}`
      );
    }
  }
};

const createOptionsSchema = z.object({
  attachments: z.boolean().optional(),
  codeExecutionTool: z.string().optional(),
  documents: z.boolean().optional(),
  electron: z.boolean().optional(),
  fromGit: z.string().optional(),
  gateway: z.string().optional(),
  imageGenerationTool: z.string().optional(),
  mcp: z.boolean().optional(),
  projects: z.boolean().optional(),
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
  sandboxProvider: z.string().optional(),
  target: z.string().optional(),
  urlRetrievalTool: z.string().optional(),
  videoGenerationTool: z.string().optional(),
  yes: z.boolean(),
});

type CreateOptions = z.infer<typeof createOptionsSchema>;
type AssistantTools = Awaited<ReturnType<typeof promptAssistantTools>>;

interface CreateSetup {
  assistantTools: AssistantTools;
  auth: Awaited<ReturnType<typeof promptAuth>>;
  coreFeatures: Awaited<ReturnType<typeof promptCoreFeatures>>;
  documentTypes: Awaited<ReturnType<typeof promptDocumentTypes>>;
  gateway: Awaited<ReturnType<typeof resolveGateway>>["definition"]["id"];
  gatewaySelection: Awaited<ReturnType<typeof resolveGateway>>;
  observability: Awaited<ReturnType<typeof promptObservability>>;
  plan: Awaited<ReturnType<typeof planInstallation>>;
  storage: Awaited<ReturnType<typeof promptStorage>>;
  sandbox: Awaited<ReturnType<typeof resolveSandbox>> | undefined;
  usesStorage: boolean;
  withElectron: boolean;
}

interface ProjectTarget {
  appName: string;
  appPrefix: string;
  appUrl: string;
  displayPath: string;
  projectName: string;
  targetDir: string;
}

const collectToolSources = async (
  options: Readonly<CreateOptions>,
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
      plugin: "videoGeneration",
      prompt: promptVideoGenerationTool,
      slot: "generateVideo",
      source: options.videoGenerationTool,
    },
    {
      plugin: "imageGeneration",
      prompt: promptImageGenerationTool,
      slot: "generateImage",
      source: options.imageGenerationTool,
    },
    {
      plugin: "webSearch",
      prompt: promptSearchTool,
      slot: "webSearch",
      source: options.searchTool,
    },
    {
      plugin: "codeExecution",
      prompt: promptCodeExecutionTool,
      slot: "codeExecution",
      source: options.codeExecutionTool,
    },
    {
      plugin: "urlRetrieval",
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
      assistantTools.builtInTools[selection.plugin] = true;
    }
    if (assistantTools.builtInTools[selection.plugin]) {
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
    await addSelection(index + NEXT_ENTRY);
  };

  await addSelection(FIRST_ENTRY);
  return toolSources;
};

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
    .map(
      (word): string =>
        word.charAt(FIRST_CHARACTER).toUpperCase() + word.slice(NEXT_CHARACTER)
    )
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
const addDocumentToolSources = (
  toolSources: string[],
  coreFeatures: ReadonlyInput<CreateSetup["coreFeatures"]>,
  documentTypes: ReadonlyInput<CreateSetup["documentTypes"]>,
  assistantTools: ReadonlyInput<AssistantTools>,
  selectedTools: readonly ReadonlyInput<z.output<typeof toolDefinitionSchema>>[]
): void => {
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
};

const promptCreateSetup = async (
  options: Readonly<CreateOptions>,
  targetDir: string
): Promise<CreateSetup> => {
  const gatewaySource = options.gateway ?? (await promptGateway(options.yes));
  const gatewaySelection = await resolveGateway(gatewaySource, targetDir);
  const coreFeatures = await promptCoreFeatures(
    options.yes,
    options.mcp,
    options.projects
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
  addDocumentToolSources(
    toolSources,
    coreFeatures,
    documentTypes,
    assistantTools,
    selectedTools
  );
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

  const { plan, sandbox } = await planSandboxInstallation(
    targetDir,
    {
      plugins: [
        ...observability,
        ...(coreFeatures.mcp ? ["mcp"] : []),
        ...(coreFeatures.projects ? ["projects"] : []),
        ...(coreFeatures.feedback ? ["feedback"] : []),
        ...(coreFeatures.followupSuggestions ? ["followup-suggestions"] : []),
        ...(coreFeatures.attachments ? ["attachment-uploads"] : []),
      ],
      gateway: gatewaySelection.source,
      storage: {
        options: storage.options,
        source: storage.source,
      },
      tools: toolSources,
    },
    { documents: options.documents, fresh: true },
    async (required) =>
      options.sandboxProvider ?? (await promptSandbox(options.yes, required))
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
    sandbox,
    usesStorage,
    withElectron,
  };
};

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
      `${JSON.stringify(packageJson, null, JSON_INDENT)}\n`
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

const oxfmtCommandFor = (packageManager: PackageManager): string[] => {
  const commands: Record<PackageManager, string[]> = {
    bun: ["run"],
    npm: ["exec", "--"],
    pnpm: ["exec"],
    yarn: ["run"],
  };
  return commands[packageManager];
};

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
      { fresh: true, managedTargets: ["lib/sandbox/options.ts"] },
      async (): Promise<void> => {
        await configureGatewayProvider(
          project.targetDir,
          setup.gatewaySelection
        );
        await configureStorageProvider(project.targetDir, setup.storage);
        if (setup.sandbox) {
          await configureSandboxProvider(project.targetDir, setup.sandbox);
        }
        installedTools = await syncTools(project.targetDir, {
          expected: plan.expected,
        });
        await syncPlugins(project.targetDir, {
          addUi: true,
          expected: plan.plugins.map((plugin) => plugin.id),
        });
      }
    );
    await runCommand(packageManager, ["install"], project.targetDir);
    await generateBaseline(project.targetDir, packageManager);
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
      "lib/sandbox/options.ts",
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
      ...(setup.sandbox?.definition.envRequirements ?? []),
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
    if (selectionOptions.length > EMPTY_SELECTION_COUNT) {
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
  .option(
    "--projects",
    "install Projects pages, chat organization, and shared instructions"
  )
  .option("--no-projects", "omit Projects from the new app")
  .option("--mcp", "install MCP connectors, pages and OAuth callback")
  .option("--no-mcp", "omit MCP from the new app")
  .option("--electron", "include the Electron desktop app")
  .option("--no-electron", "do not include the Electron desktop app")
  .option(
    "--from-git <url>",
    "clone from a git repository instead of the built-in scaffold"
  )
  .option(
    "--sandbox-provider <item>",
    "optional sandbox provider: vercel, daytona or registry address"
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
