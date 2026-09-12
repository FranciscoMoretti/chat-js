import { existsSync } from "node:fs";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { intro, outro } from "@clack/prompts";
import { Command } from "commander";
import { z } from "zod";

import { toolDefinitionSchema } from "../../../registry/metadata";
import { buildConfigTs } from "../helpers/config-builder";
import { ensureTargetEmpty } from "../helpers/ensure-target";
import { collectEnvChecklist } from "../helpers/env-checklist";
import type { EnvVarEntry } from "../helpers/env-checklist";
import { configureGatewayProvider } from "../helpers/gateway-provider";
import {
  promptAssistantTools,
  promptAuth,
  promptCoreFeatures,
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
import {
  scaffoldElectron,
  scaffoldFromGit,
  scaffoldFromTemplate,
} from "../helpers/scaffold";
import { configureStorageProvider } from "../helpers/storage-provider";
import { resolveGateway } from "../registry/gateways";
import {
  installItems,
  itemAddress,
  listTools,
  readItem,
} from "../registry/shadcn";
import { resolveStorage } from "../registry/storage";
import type { PackageManager } from "../types";
import { launcherPackageManager } from "../utils/get-package-manager";
import { handleError } from "../utils/handle-error";
import { highlighter } from "../utils/highlighter";
import { logger } from "../utils/logger";
import { preflight } from "../utils/preflight";
import { runCommand } from "../utils/run-command";
import { spinner } from "../utils/spinner";
import { syncTools } from "../utils/sync-tools";

const resolveCreateTarget = (
  targetArg: string | undefined
): {
  projectName: string;
  targetDir: string;
  displayPath: string;
} => {
  if (!targetArg) {
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

const printEnvChecklist = (entries: EnvVarEntry[]): void => {
  logger.info("Required for your configuration:");
  logger.break();

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];

    if (!entry.oneOfGroup) {
      logger.log(
        `  ${highlighter.warn("*")} ${highlighter.warn(entry.vars)} ${highlighter.dim(`- ${entry.description}`)}`
      );
      continue;
    }

    logger.log(`  ${highlighter.warn("*")} ${highlighter.dim("One of:")}`);
    while (i < entries.length && entries[i].oneOfGroup === entry.oneOfGroup) {
      const option = entries[i];
      logger.log(
        `    ${highlighter.warn("*")} ${highlighter.warn(option.vars)} ${highlighter.dim(`- ${option.description}`)}`
      );
      i += 1;
    }
    i -= 1;
  }
};

const removeSelectedClonedTools = async (targetDir: string): Promise<void> => {
  const toolDirectory = path.join(targetDir, "tools/chatjs");
  const entries = await readdir(toolDirectory, { withFileTypes: true }).catch(
    (error) => {
      if (error.code === "ENOENT") {
        return [];
      }
      throw error;
    }
  );

  await Promise.all(
    entries.map(async (entry) => {
      if (!entry.isDirectory()) {
        return;
      }
      const descriptor = path.join(toolDirectory, entry.name, "chatjs.json");
      if (!existsSync(descriptor)) {
        return;
      }
      await preflight(targetDir, [`tools/chatjs/${entry.name}/chatjs.json`]);
      const metadata = toolDefinitionSchema.parse(
        JSON.parse(await readFile(descriptor, "utf-8"))
      );
      const usesSelectedSlot =
        metadata.slot === "webSearch" ||
        metadata.slot === "codeExecution" ||
        metadata.slot === "retrieveUrl" ||
        metadata.slot === "generateImage" ||
        metadata.slot === "generateVideo" ||
        (metadata.id === "retrieve-url" &&
          metadata.toolExport === "retrieveUrl");
      if (usesSelectedSlot) {
        await rm(path.join(toolDirectory, entry.name), { recursive: true });
      }
    })
  );
};

const createOptionsSchema = z.object({
  codeExecutionTool: z.string().optional(),
  electron: z.boolean().optional(),
  fromGit: z.string().optional(),
  gateway: z.string().optional(),
  imageGenerationTool: z.string().optional(),
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

const collectToolSources = async (
  options: CreateOptions,
  assistantTools: AssistantTools,
  targetDir: string
): Promise<string[]> => {
  const toolSources = assistantTools.installableTools.map((tool) =>
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
    if (selection.source) {
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

const promptProjectTarget = async (
  options: CreateOptions
): Promise<ProjectTarget> => {
  const initialTarget = resolveCreateTarget(options.target);
  const projectName = await promptProjectName(
    initialTarget.projectName,
    options.yes
  );
  const targetDir = options.target
    ? initialTarget.targetDir
    : path.resolve(process.cwd(), projectName);
  const displayPath = options.target ? initialTarget.displayPath : projectName;
  const appName = projectName
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
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

const promptCreateSetup = async (options: CreateOptions, targetDir: string) => {
  const gatewaySource = options.gateway ?? (await promptGateway(options.yes));
  const gatewaySelection = await resolveGateway(gatewaySource, targetDir);
  const coreFeatures = await promptCoreFeatures(
    options.yes,
    gatewaySelection.definition
  );
  const documentTypes = await promptDocumentTypes(
    options.yes,
    coreFeatures.documents,
    gatewaySelection.definition
  );
  const registryItems = await loadInstallableTools(options, targetDir);
  const assistantTools = await promptAssistantTools(
    registryItems,
    options.yes,
    gatewaySelection.definition
  );
  const toolSources = await collectToolSources(
    options,
    assistantTools,
    targetDir
  );
  const expectedTools = await Promise.all(
    toolSources.map(async (source) => {
      const item = await readItem(source, targetDir);
      return toolDefinitionSchema.parse(item.meta?.chatjs);
    })
  );
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
    expectedTools,
    gateway: gatewaySelection.definition.id,
    gatewaySelection,
    storage,
    toolSources,
    usesStorage,
    withElectron,
  };
};

const prepareGitScaffold = async (targetDir: string): Promise<boolean> => {
  if (!existsSync(path.join(targetDir, "lib/ai/gateway.ts"))) {
    logger.warn(
      "This repository has no ChatJS gateway slot. Skipping ChatJS configuration and installation."
    );
    return false;
  }
  if (!existsSync(path.join(targetDir, "lib/storage-options.ts"))) {
    throw new Error(
      "This ChatJS clone predates storage registry support. Update its storage integration before using create --from-git."
    );
  }
  if (
    existsSync(path.join(targetDir, "tools/platform/generate-image.ts")) ||
    existsSync(path.join(targetDir, "tools/platform/generate-video.ts"))
  ) {
    throw new Error(
      "This ChatJS clone uses legacy media tool factories. Update its image/video registry integration before using create --from-git."
    );
  }
  // create owns the new clone's selected gateway. Remove this one slot before
  // shadcn installs so skipping a file cannot mismatch defaults.
  await preflight(targetDir, [
    "lib/ai/gateway.ts",
    "lib/storage-provider.ts",
    "chat.config.ts",
    "package.json",
  ]);
  await rm(path.join(targetDir, "lib/storage-provider.ts"), { force: true });
  await rm(path.join(targetDir, "lib/ai/gateway.ts"));
  await removeSelectedClonedTools(targetDir);
  return true;
};

const scaffoldProject = async (
  options: CreateOptions,
  project: ProjectTarget,
  packageManager: PackageManager,
  withElectron: boolean
): Promise<boolean> => {
  const scaffoldSpinner = spinner("Scaffolding project...").start();
  try {
    if (options.fromGit) {
      await scaffoldFromGit(options.fromGit, project.targetDir);
      if (!(await prepareGitScaffold(project.targetDir))) {
        scaffoldSpinner.succeed("Repository cloned.");
        return false;
      }
    } else {
      await scaffoldFromTemplate(project.targetDir, { packageManager });
    }
    if (withElectron) {
      await scaffoldElectron(project.targetDir, {
        packageManager,
        projectName: project.projectName,
      });
    }
    scaffoldSpinner.succeed("Project scaffolded.");
    return true;
  } catch (error) {
    scaffoldSpinner.fail("Failed to scaffold project.");
    throw error;
  }
};

const writeConfiguration = async (
  project: ProjectTarget,
  setup: Awaited<ReturnType<typeof promptCreateSetup>>
): Promise<void> => {
  const configSpinner = spinner("Writing configuration...").start();
  try {
    const packageJsonPath = path.join(project.targetDir, "package.json");
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
        builtInTools: setup.assistantTools.builtInTools,
        coreFeatures: setup.coreFeatures,
        documentTypes: setup.documentTypes,
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
  options: CreateOptions,
  packageManager: PackageManager,
  project: ProjectTarget,
  setup: Awaited<ReturnType<typeof promptCreateSetup>>
): Promise<Awaited<ReturnType<typeof syncTools>>> => {
  const installSpinner = spinner(
    "Installing selected registry items..."
  ).start();
  try {
    await installItems(
      [
        setup.gatewaySelection.source,
        setup.storage.source,
        ...setup.toolSources,
      ],
      project.targetDir
    );
    await configureGatewayProvider(project.targetDir, setup.gatewaySelection);
    await configureStorageProvider(project.targetDir, setup.storage);
    const installedTools = await syncTools(project.targetDir, {
      expected: setup.expectedTools,
    });
    await runCommand(packageManager, ["install"], project.targetDir);
    if (!options.fromGit) {
      await runCommand(
        packageManager,
        [...oxfmtCommandFor(packageManager), "oxfmt", "--write", "."],
        project.targetDir
      );
    }
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
    `  ${highlighter.dim("3.")} ${highlighter.info(`${packageManager} run db:connect`)} then ${highlighter.info(`${packageManager} run db:push`)}`
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
  logger.log(
    `  Optional Redis: set REDIS_URL, then run ${packageManager} run redis:connect. Setup: https://www.chatjs.dev/docs/reference/redis`
  );
  logger.break();
  logger.log(
    `  For detailed setup instructions, visit ${highlighter.info("https://www.chatjs.dev/docs/quickstart")}`
  );
};

const createProject = async (options: CreateOptions): Promise<void> => {
  const packageManager = launcherPackageManager();
  if (!options.yes) {
    intro("Create ChatJS App");
  }
  const project = await promptProjectTarget(options);
  await ensureTargetEmpty(project.targetDir);
  const setup = await promptCreateSetup(options, project.targetDir);
  logger.break();
  if (
    !(await scaffoldProject(
      options,
      project,
      packageManager,
      setup.withElectron
    ))
  ) {
    return;
  }
  await writeConfiguration(project, setup);
  const installedTools = await installRegistryItems(
    options,
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
  .action(async (directory, opts) => {
    try {
      await createProject(
        createOptionsSchema.parse({ target: directory, ...opts })
      );
    } catch (error) {
      handleError(error);
    }
  });
