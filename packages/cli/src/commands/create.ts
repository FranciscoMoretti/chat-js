import {
  selectionCommand,
  parseCreateFlags,
} from "#cli/helpers/selection-options";
import type { CreateSelectionFlags } from "#cli/helpers/selection-options";
import { defaultAuthProviders } from "../../../registry/installation";
import { installEveIntegrations } from "#cli/helpers/eve-integrations";
import { registryResolution } from "#cli/registry/resolution-context";
import { parseAgentRecipe, writeAgentRecipe } from "#cli/helpers/agent-recipe";
import type { AgentRecipe } from "#cli/helpers/agent-recipe";
import {
  readCreateInstallation,
  assertExclusiveInstallation,
} from "#cli/helpers/create-installation";
import { optionalDirectoryFiles } from "#cli/utils/installation-files";
import { writeAgentConfiguration } from "#cli/helpers/agent-configuration";
import { recordInstalledSource } from "#cli/utils/source-receipt";
import { scaffoldNativeProject } from "#cli/helpers/native-scaffold";
import { createStagedProject } from "#cli/helpers/staged-project";
import { generateBaseline } from "#cli/utils/generate-baseline";
import {
  createSelectionFromFlags,
  promptCreateMenu,
} from "#cli/helpers/create-menu";
import { resolveStorage } from "#cli/registry/storage";
import type { InstallationSelection } from "../../../registry/installation";
import type { AuthProvider, CoreFeatureKey, PackageManager } from "#cli/types";
import { configureSandboxProvider } from "#cli/helpers/sandbox-provider";
import { resolveSandbox } from "#cli/registry/sandboxes";
import { installPlan, plannedSourceTargets } from "#cli/utils/install-plan";
import { intro, outro } from "@clack/prompts";
import { promptAuth, promptProjectName } from "#cli/helpers/prompts";
import { readFile, writeFile } from "node:fs/promises";
import { scaffoldElectron, scaffoldFromGit } from "#cli/helpers/scaffold";
import type { Command } from "commander";
import type { ReadonlyInput } from "#cli/helpers/readonly-input";
import { buildConfigTs } from "#cli/helpers/config-builder";
import {
  collectEnvChecklist,
  formatEnvChecklist,
} from "#cli/helpers/env-checklist";
import { configureGatewayProvider } from "#cli/helpers/gateway-provider";
import {
  configureStorageProvider,
  applyStorageOptions,
} from "#cli/helpers/storage-provider";
import { ensureTargetEmpty } from "#cli/helpers/ensure-target";
import {
  assertCreateShadcnReady,
  createShadcnArguments,
} from "#cli/helpers/create-shadcn-arguments";
import { handleError } from "#cli/utils/handle-error";
import { launcherPackageManager } from "#cli/utils/get-package-manager";
import { logger } from "#cli/utils/logger";
import { parseJsonObject } from "#cli/helpers/json-object";
import path from "node:path";
import { planInstallation } from "#cli/utils/installation-plan";
import { resolveGateway } from "#cli/registry/gateways";
import { runCommand } from "#cli/utils/run-command";
import { spinner } from "#cli/utils/spinner";
import { syncPlugins } from "#cli/utils/sync-plugins";
import { syncTools } from "#cli/utils/sync-tools";
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
  const outside =
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath);

  return {
    displayPath: outside ? targetDir : relativePath || ".",
    projectName,
    targetDir,
  };
};

const JSON_INDENT = 2;
const FIRST_CHARACTER = 0;
const NEXT_CHARACTER = 1;
const EMPTY_SELECTION_COUNT = 0;

const shellPath = (value: string): string => {
  const directory = value.startsWith("-") ? `./${value}` : value;
  return /^[a-zA-Z0-9_./-]+$/u.test(directory)
    ? directory
    : `'${directory.replaceAll("'", "'\"'\"'")}'`;
};

const createOptionsSchema = z.object({
  recipe: z.string().optional(),
  appPreset: z.string().optional(),
  installation: z.string().optional(),
  fromGit: z.string().optional(),
  target: z.string().optional(),
  yes: z.boolean(),
});

type CreateOptions = z.infer<typeof createOptionsSchema> & CreateSelectionFlags;

interface CreateSetup {
  auth: Record<AuthProvider, boolean>;
  coreFeatures: Record<CoreFeatureKey, boolean>;
  gateway: Awaited<ReturnType<typeof resolveGateway>>["definition"]["id"];
  gatewaySelection: Awaited<ReturnType<typeof resolveGateway>>;
  plan: Awaited<ReturnType<typeof planInstallation>>;
  storage: ReturnType<typeof applyStorageOptions>;
  sandbox: Awaited<ReturnType<typeof resolveSandbox>> | undefined;
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

const promptProjectTarget = async (
  options: Readonly<CreateOptions>
): Promise<ProjectTarget> => {
  const initialTarget = resolveCreateTarget(options.target);
  const projectName = await promptProjectName(
    initialTarget.projectName,
    options.yes || options.target !== undefined
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

const prepareCreateSetup = async (
  selection: InstallationSelection,
  targetDir: string
): Promise<CreateSetup> => {
  const storage = applyStorageOptions(
    await resolveStorage(selection.storage?.source ?? "memory", targetDir),
    selection.storage?.options ?? {}
  );
  const plan = await planInstallation(
    targetDir,
    {
      ...selection,
      auth: selection.auth ?? defaultAuthProviders,
      storage: { source: storage.source, options: storage.options },
    },
    { fresh: true, requireToolKind: true }
  );
  const gatewaySelection = await resolveGateway(
    selection.gateway ?? "vercel",
    targetDir
  );
  const plugins = new Set(plan.plugins.map((plugin) => plugin.id));
  const providers: readonly AuthProvider[] =
    selection.auth ?? defaultAuthProviders;
  return {
    auth: {
      github: providers.includes("github"),
      google: providers.includes("google"),
      vercel: providers.includes("vercel"),
    },
    coreFeatures: {
      attachments: plugins.has("attachment-uploads"),
      feedback: plugins.has("feedback"),
      followupSuggestions: plugins.has("followup-suggestions"),
      mcp: plugins.has("mcp"),
      projects: plugins.has("projects"),
    },
    gateway: gatewaySelection.definition.id,
    gatewaySelection,
    plan,
    storage,
    sandbox:
      selection.sandbox === undefined
        ? undefined
        : await resolveSandbox(selection.sandbox, targetDir),
    withElectron: plugins.has("desktop"),
  };
};

const configureCreate = async (
  options: Readonly<CreateOptions>,
  project: Readonly<ProjectTarget>,
  appearance: readonly string[]
): Promise<{ setup: CreateSetup; appearance: readonly string[] }> => {
  if (options.installation !== undefined || options.appPreset !== undefined) {
    const selection = readCreateInstallation({
      appPreset: options.appPreset,
      installation: options.installation,
      storageConfig: options.storageConfig,
    });
    if (!options.yes && selection.auth === undefined) {
      selection.auth = await promptAuth();
    }
    return {
      setup: await prepareCreateSetup(selection, project.targetDir),
      appearance,
    };
  }
  const selection = await createSelectionFromFlags(project.targetDir, options);
  if (!options.yes) {
    return await promptCreateMenu(
      project,
      selection,
      appearance,
      async (draft) =>
        await prepareCreateSetup(draft.selection, project.targetDir)
    );
  }
  return {
    setup: await prepareCreateSetup(selection, project.targetDir),
    appearance,
  };
};

const scaffoldProject = async (
  project: Readonly<ProjectTarget>,
  packageManager: PackageManager,
  withElectron: boolean,
  shadcnArgs: readonly string[],
  recipe?: AgentRecipe
): Promise<void> => {
  await scaffoldNativeProject(
    project.targetDir,
    packageManager,
    shadcnArgs,
    recipe
  );
  if (withElectron) {
    await scaffoldElectron(project.targetDir, {
      packageManager,
      projectName: project.projectName,
    });
  }
};
const writeConfiguration = async (
  project: Readonly<ProjectTarget>,
  setup: ReadonlyInput<CreateSetup>
): Promise<void> => {
  const configSpinner = spinner("Writing app configuration…").start();
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
      })
    );
    if (setup.plan.selection.modelPicker === "none") {
      await writeFile(
        path.join(project.targetDir, "integrations/chat/model-picker.ts"),
        'import type { TurnModelPickerProps } from "@/chatjs/core/chat/turn-model-picker";\n\nexport const TurnModelPicker = (_props: TurnModelPickerProps): null => null;\n'
      );
    }
    await writeAgentConfiguration(
      project.targetDir,
      setup.plan.selection.agent
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
  setup: ReadonlyInput<CreateSetup>
): Promise<Awaited<ReturnType<typeof syncTools>>> => {
  const installSpinner = spinner("Installing app capabilities…").start();
  try {
    const { plan } = setup;
    let installedTools: Awaited<ReturnType<typeof syncTools>> = [];
    await installPlan(
      project.targetDir,
      plan,
      { fresh: true, managedTargets: [] },
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
        "chatjs/installed-dependencies.json",
      ],
      project.targetDir
    );
    await recordInstalledSource(project.targetDir, [
      ...plannedSourceTargets(plan),
      ...(await optionalDirectoryFiles(project.targetDir, "chatjs/core")),
      ...(await optionalDirectoryFiles(project.targetDir, "chatjs/providers")),
      "chat.config.ts",
      "chatjs/providers/gateway-defaults.ts",
      "chatjs/providers/storage-options.ts",
      ".env.example",
    ]);
    installSpinner.succeed("App capabilities installed.");
    return installedTools;
  } catch (error) {
    installSpinner.fail("Could not install the selected capabilities.");
    throw error;
  }
};

const printNextSteps = (
  packageManager: PackageManager,
  project: Readonly<ProjectTarget>,
  setup: ReadonlyInput<CreateSetup>,
  installedTools: ReadonlyInput<Awaited<ReturnType<typeof syncTools>>>
): void => {
  const envEntries = collectEnvChecklist({
    auth: setup.auth,
    coreFeatures: setup.coreFeatures,
    gateway: setup.gateway,
    gatewayRequirements: setup.gatewaySelection.definition.envRequirements,
    storageRequirements: setup.storage.definition.envRequirements,
    sandboxRequirements: setup.sandbox?.definition.envRequirements,
    installableToolEnvRequirements: [
      ...installedTools.flatMap((tool) => tool.envRequirements),
      ...setup.plan.plugins.flatMap((plugin) => plugin.envRequirements ?? []),
    ],
  });

  outro(`Created ${project.projectName}.`);
  logger.break();
  logger.info("Prepare your environment");
  logger.log(`  cd -- ${shellPath(project.displayPath)}`);
  logger.log("  cp .env.example .env.local");
  logger.break();
  logger.info("Fill in .env.local");
  logger.break();
  logger.log(formatEnvChecklist(envEntries));
  if ((setup.plan.selection.eve?.length ?? 0) > 0) {
    logger.log(
      "  Follow chatjs/eve-setup.md to connect the selected EVE capabilities."
    );
  }
  logger.break();
  logger.info("Initialize the database and start the app");
  logger.log(`  ${packageManager} run setup`);
  logger.log(`  ${packageManager} run dev`);
  if (setup.withElectron) {
    logger.break();
    logger.info("Start the Electron app in a second terminal");
    logger.log(
      `  cd -- ${shellPath(path.join(project.displayPath, "electron"))}`
    );
    logger.log(`  ${packageManager} install`);
    logger.log(`  ${packageManager} run dev`);
  }
  logger.break();
  logger.info("Setup guide");
  logger.log("  https://www.chatjs.dev/docs/quickstart");
  logger.break();
};

const createProject = async (
  options: Readonly<CreateOptions>,
  shadcnArgs: readonly string[],
  recipe?: AgentRecipe
): Promise<void> => {
  const packageManager = launcherPackageManager();
  if (recipe && packageManager !== "bun") {
    throw new Error(
      "Replay this recipe with Bun so its frozen dependency lock is honored."
    );
  }
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
    outro(`Cloned ${project.projectName}.`);
    logger.log(`  cd -- ${shellPath(project.displayPath)}`);
    logger.info("Follow the repository’s setup instructions.");
    return;
  }
  const { setup, appearance } = await configureCreate(
    options,
    project,
    shadcnArgs
  );
  logger.break();
  logger.info(`Creating ${project.projectName}…`);
  const installedTools = await createStagedProject(
    project.targetDir,
    async (stage) => {
      const stagedProject = { ...project, targetDir: stage };
      await scaffoldProject(
        stagedProject,
        packageManager,
        setup.withElectron,
        appearance,
        recipe
      );
      // Resolve only after native init has selected the actual library.
      setup.plan = await planInstallation(stage, setup.plan.selection, {
        fresh: true,
      });
      await writeConfiguration(stagedProject, setup);
      const installed = await installRegistryItems(
        packageManager,
        stagedProject,
        setup
      );
      const eve = await installEveIntegrations(
        stage,
        setup.plan.selection.eve ?? [],
        packageManager,
        recipe?.eve,
        setup.plan.selection.eveRegistries
      );
      if (recipe) {
        const lockfile = recipe.native.find((file) => file.path === "bun.lock");
        if (!lockfile) {
          throw new Error("Recipe is missing its dependency lock.");
        }
        await writeFile(path.join(stage, "bun.lock"), lockfile.content);
        await runCommand("bun", ["install", "--frozen-lockfile"], stage);
      }
      if (packageManager === "bun") {
        await writeAgentRecipe(stage, {
          selection: setup.plan.selection,
          appearance: [...appearance],
          capabilities: setup.plan.resolvedItems,
          eve,
        });
        await runCommand(
          "bun",
          ["run", "oxfmt", "--write", "chatjs/agent-recipe.json"],
          stage
        );
      }
      return installed;
    }
  );
  printNextSteps(packageManager, project, setup, installedTools);
};

export const create = selectionCommand("create")
  .option("--app-preset <code>", "App preset code; bypasses feature defaults")
  .option(
    "--recipe <path>",
    "replay a saved Agent recipe with frozen capabilities and dependencies"
  )
  .option(
    "--installation <json>",
    "complete JSON selection; bypasses feature defaults"
  )
  .description("scaffold a new ChatJS chat application")
  .argument("[directory]", "target directory for the project")
  .argument("[shadcn-options...]", "native shadcn options after --")
  .option("-y, --yes", "skip prompts and use defaults", false)
  .option(
    "--from-git <url>",
    "clone from a git repository instead of the built-in scaffold"
  )
  .action(
    async (
      _directory: unknown,
      _shadcnOptions: unknown,
      opts: Readonly<Record<string, unknown>>,
      command: Readonly<Command>
    ): Promise<void> => {
      try {
        const { target, shadcnArgs } = createShadcnArguments(command);
        const options = {
          ...createOptionsSchema.parse({ target, ...opts }),
          ...parseCreateFlags(opts),
        };
        if (options.recipe !== undefined) {
          const conflicts = Object.entries(options).filter(
            ([key, value]) =>
              !["recipe", "target", "yes"].includes(key) && value !== undefined
          );
          if (conflicts.length > 0 || shadcnArgs.length > 0) {
            throw new Error(
              "--recipe cannot be combined with selection or appearance options. Edit the builder choices and generate a new recipe for an upgrade."
            );
          }
          const recipe = parseAgentRecipe(
            JSON.parse(await readFile(path.resolve(options.recipe), "utf-8"))
          );
          await registryResolution.run(
            new Map(
              recipe.capabilities.map(({ source, item }) => [source, item])
            ),
            async () => {
              await createProject(
                {
                  target,
                  yes: options.yes,
                  installation: JSON.stringify(recipe.selection),
                },
                recipe.appearance,
                recipe
              );
            }
          );
          return;
        }
        assertExclusiveInstallation(options);
        assertCreateShadcnReady(shadcnArgs, options.fromGit);
        await createProject(options, shadcnArgs);
      } catch (error) {
        handleError(error);
      }
    }
  );
