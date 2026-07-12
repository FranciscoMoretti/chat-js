import { readFile, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { intro, outro } from "@clack/prompts";
import { Command } from "commander";
import { z } from "zod";
import { buildConfigTs } from "../helpers/config-builder";
import { ensureTargetEmpty } from "../helpers/ensure-target";
import {
	collectEnvChecklist,
	type EnvVarEntry,
} from "../helpers/env-checklist";
import {
	promptAssistantTools,
	promptAuth,
	promptCoreFeatures,
	promptDocumentTypes,
	promptElectron,
	promptGateway,
	promptInstall,
	promptProjectName,
	promptStorage,
} from "../helpers/prompts";
import {
	scaffoldElectron,
	scaffoldFromGit,
	scaffoldFromTemplate,
} from "../helpers/scaffold";
import { storageEnvRequirements } from "../helpers/storage-provider";
import type {
	EnvRequirement as RegistryEnvRequirement,
	RegistryIndexItem,
} from "../registry/schema";
import { fetchRegistryIndex } from "../registry/fetch";
import { loadProjectUiConfig, resolveProjectPath } from "../utils/get-config";
import { inferPackageManager } from "../utils/get-package-manager";
import { handleError } from "../utils/handle-error";
import { highlighter } from "../utils/highlighter";
import { installRegistryTools } from "../utils/install-registry-tools";
import { logger } from "../utils/logger";
import { runCommand } from "../utils/run-command";
import { spinner } from "../utils/spinner";

function resolveCreateTarget(targetArg: string | undefined): {
	projectName: string;
	targetDir: string;
	displayPath: string;
} {
	if (!targetArg) {
		const projectName = "my-chat-app";
		return {
			projectName,
			targetDir: resolve(process.cwd(), projectName),
			displayPath: projectName,
		};
	}

	const targetDir = resolve(process.cwd(), targetArg);
	const projectName = basename(targetDir);
	const relativePath = relative(process.cwd(), targetDir);

	return {
		projectName,
		targetDir,
		displayPath: relativePath || ".",
	};
}

function printEnvChecklist(entries: EnvVarEntry[]): void {
	logger.info("Required for your configuration:");
	logger.break();

	for (let i = 0; i < entries.length; i += 1) {
		const entry = entries[i];

		if (!entry.oneOfGroup) {
			logger.log(
				`  ${highlighter.warn("*")} ${highlighter.warn(entry.vars)} ${highlighter.dim(`- ${entry.description}`)}`,
			);
			continue;
		}

		logger.log(`  ${highlighter.warn("*")} ${highlighter.dim("One of:")}`);
		while (i < entries.length && entries[i].oneOfGroup === entry.oneOfGroup) {
			const option = entries[i];
			logger.log(
				`    ${highlighter.warn("*")} ${highlighter.warn(option.vars)} ${highlighter.dim(`- ${option.description}`)}`,
			);
			i += 1;
		}
		i -= 1;
	}
}

export function selectedRegistryToolsRequireStorage(
	registryItems: RegistryIndexItem[],
	selectedToolNames: string[],
): boolean {
	const selectedTools = new Set(selectedToolNames);

	return registryItems.some(
		(item) =>
			selectedTools.has(item.name) &&
			item.projectRequirements?.includes("storage"),
	);
}

const createOptionsSchema = z.object({
	target: z.string().optional(),
	yes: z.boolean(),
	install: z.boolean(),
	electron: z.boolean().optional(),
	fromGit: z.string().optional(),
	registry: z.string().optional(),
	packageManager: z.enum(["bun", "npm", "pnpm", "yarn"]).optional(),
	storageProvider: z.string().optional(),
	storageConfig: z.string().optional(),
});

export const create = new Command()
	.name("create")
	.description("scaffold a new ChatJS chat application")
	.argument("[directory]", "target directory for the project")
	.option("-y, --yes", "skip prompts and use defaults", false)
	.option("--no-install", "skip dependency installation")
	.option("--electron", "include the Electron desktop app")
	.option("--no-electron", "do not include the Electron desktop app")
	.option(
		"-r, --registry <url>",
		"registry URL or local path template (e.g. ./packages/registry/items/{name}.json)",
	)
	.option(
		"--package-manager <manager>",
		"package manager for install + next steps (bun, npm, pnpm, yarn)",
	)
	.option(
		"--from-git <url>",
		"clone from a git repository instead of the built-in scaffold",
	)
	.option(
		"--storage-provider <provider>",
		"Files SDK provider (for example: vercel-blob, s3, r2, gcs)",
	)
	.option(
		"--storage-config <json>",
		"non-secret JSON options for the Files SDK adapter; credentials use env vars",
	)
	.action(async (directory, opts) => {
		try {
			const options = createOptionsSchema.parse({
				target: directory,
				...opts,
			});

			const packageManager = options.packageManager ?? inferPackageManager();

			if (!options.yes) {
				intro("Create ChatJS App");
			}

			const initialTarget = resolveCreateTarget(options.target);
			const projectName = await promptProjectName(
				initialTarget.projectName,
				options.yes,
			);
			const targetDir = options.target
				? initialTarget.targetDir
				: resolve(process.cwd(), projectName);
			const displayPath = options.target
				? initialTarget.displayPath
				: projectName;

			await ensureTargetEmpty(targetDir);

			const appName = projectName
				.split("-")
				.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
				.join(" ");
			const appPrefix = projectName;
			const appUrl = "http://localhost:3000";

			const gateway = await promptGateway(options.yes);
			const coreFeatures = await promptCoreFeatures(options.yes);
			const documentTypes = await promptDocumentTypes(
				options.yes,
				coreFeatures.documents,
			);

			let registryItems: Awaited<ReturnType<typeof fetchRegistryIndex>> = [];
			if (!options.yes) {
				const registrySpinner = spinner("Loading installable tools...");
				registrySpinner.start();
				try {
					registryItems = await fetchRegistryIndex(options.registry);
					registrySpinner.succeed("Installable tools loaded.");
				} catch (error) {
					registrySpinner.fail("Could not load installable tools.");
					logger.warn(
						error instanceof Error
							? error.message
							: "Continuing with built-in tools only.",
					);
				}
			}

			const assistantTools = await promptAssistantTools(
				registryItems,
				options.yes,
				gateway,
			);
			const usesStorage =
				coreFeatures.attachments ||
				assistantTools.builtInTools.imageGeneration ||
				assistantTools.builtInTools.videoGeneration ||
				selectedRegistryToolsRequireStorage(
					registryItems,
					assistantTools.installableTools,
				) ||
				options.storageProvider !== undefined ||
				options.storageConfig !== undefined;
			const storage = usesStorage
				? await promptStorage(
						options.yes,
						options.storageProvider,
						options.storageConfig,
					)
				: {
						provider: "memory" as const,
						options: {},
					};
			const auth = await promptAuth(options.yes);
			const withElectron = await promptElectron(options.yes, options.electron);

			logger.break();
			const scaffoldSpinner = spinner("Scaffolding project...").start();
			try {
				if (options.fromGit) {
					await scaffoldFromGit(options.fromGit, targetDir, { storage });
				} else {
					await scaffoldFromTemplate(targetDir, {
						packageManager,
						storage,
					});
				}
				if (withElectron) {
					await scaffoldElectron(targetDir, {
						projectName,
						packageManager,
					});
				}
				scaffoldSpinner.succeed("Project scaffolded.");
			} catch (error) {
				scaffoldSpinner.fail("Failed to scaffold project.");
				throw error;
			}

			const configSpinner = spinner("Writing configuration...").start();
			try {
				const packageJsonPath = join(targetDir, "package.json");
				const packageJson = JSON.parse(
					await readFile(packageJsonPath, "utf8"),
				) as {
					name?: string;
				};
				packageJson.name = projectName;
				await writeFile(
					packageJsonPath,
					`${JSON.stringify(packageJson, null, 2)}\n`,
				);

				const configSource = buildConfigTs({
					appName,
					appPrefix,
					appUrl,
					withElectron,
					gateway,
					coreFeatures,
					documentTypes,
					builtInTools: assistantTools.builtInTools,
					auth,
				});
				await writeFile(join(targetDir, "chat.config.ts"), configSource);
				configSpinner.succeed("Configuration written.");
			} catch (error) {
				configSpinner.fail("Failed to write configuration.");
				throw error;
			}

			const installNow = !options.install
				? false
				: await promptInstall(packageManager, options.yes);

			let installableToolEnvRequirements: RegistryEnvRequirement[] = [];
			if (assistantTools.installableTools.length > 0) {
				const uiConfig = await loadProjectUiConfig(targetDir);
				const [toolsDir, uiDir] = await Promise.all([
					resolveProjectPath("@/tools/chatjs", targetDir),
					resolveProjectPath(uiConfig.alias, targetDir),
				]);
				const registryInstall = await installRegistryTools({
					tools: assistantTools.installableTools,
					cwd: targetDir,
					toolsDir,
					toolsAlias: "@/tools/chatjs",
					uiDir,
					uiAlias: uiConfig.alias,
					registryUrl: options.registry,
					installDependenciesNow: false,
					packageManager,
				});
				installableToolEnvRequirements = registryInstall.envRequirements;
			}

			if (installNow) {
				const installSpinner = spinner(
					`Installing dependencies with ${highlighter.info(packageManager)}...`,
				).start();
				try {
					await runCommand(packageManager, ["install"], targetDir);
					installSpinner.succeed("Dependencies installed.");
				} catch (error) {
					installSpinner.fail("Failed to install dependencies.");
					throw error;
				}
			}

			const envEntries = collectEnvChecklist({
				gateway,
				coreFeatures,
				builtInTools: assistantTools.builtInTools,
				auth,
				installableToolEnvRequirements: [
					...installableToolEnvRequirements,
					...(usesStorage
						? storageEnvRequirements(storage.provider, storage.options)
						: []),
				],
			});

			outro("Your ChatJS app is ready!");

			logger.info("Next steps:");
			logger.break();
			logger.log(
				`  ${highlighter.dim("1.")} cd ${highlighter.info(displayPath)}`,
			);
			logger.log(
				`  ${highlighter.dim("2.")} Copy ${highlighter.info(".env.example")} to ${highlighter.info(".env.local")} and fill in the values below`,
			);
			if (!installNow) {
				logger.log(
					`  ${highlighter.dim("3.")} ${highlighter.info(`${packageManager} install`)}`,
				);
				logger.log(
					`  ${highlighter.dim("4.")} ${highlighter.info(`${packageManager} run db:push`)}`,
				);
				logger.log(
					`  ${highlighter.dim("5.")} ${highlighter.info(`${packageManager} run dev`)}`,
				);
			} else {
				logger.log(
					`  ${highlighter.dim("3.")} ${highlighter.info(`${packageManager} run db:push`)}`,
				);
				logger.log(
					`  ${highlighter.dim("4.")} ${highlighter.info(`${packageManager} run dev`)}`,
				);
			}
			if (withElectron) {
				logger.break();
				logger.info("Electron desktop app:");
				logger.log(
					`  Run the web app first, then: ${highlighter.info(`cd electron && ${packageManager} install && ${packageManager} run dev`)}`,
				);
			}
			logger.break();

			printEnvChecklist(envEntries);

			logger.break();
			logger.log(
				`  For detailed setup instructions, visit ${highlighter.info("https://www.chatjs.dev/docs/quickstart")}`,
			);
		} catch (error) {
			handleError(error);
		}
	});
