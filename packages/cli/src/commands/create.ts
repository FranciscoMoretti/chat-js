import { existsSync } from "node:fs";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { intro, outro } from "@clack/prompts";
import { Command } from "commander";
import { z } from "zod";
import { toolDefinitionSchema } from "../../../registry/metadata";
import { buildConfigTs } from "../helpers/config-builder";
import { ensureTargetEmpty } from "../helpers/ensure-target";
import {
	collectEnvChecklist,
	type EnvVarEntry,
} from "../helpers/env-checklist";
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
	promptCodeExecutionTool,
} from "../helpers/prompts";
import {
	scaffoldElectron,
	scaffoldFromGit,
	scaffoldFromTemplate,
} from "../helpers/scaffold";
import { resolveStorage } from "../registry/storage";
import { configureStorageProvider } from "../helpers/storage-provider";
import { resolveGateway } from "../registry/gateways";
import {
	installItems,
	itemAddress,
	listTools,
	readItem,
} from "../registry/shadcn";
import { launcherPackageManager } from "../utils/get-package-manager";
import { handleError } from "../utils/handle-error";
import { highlighter } from "../utils/highlighter";
import { logger } from "../utils/logger";
import { preflight } from "../utils/preflight";
import { runCommand } from "../utils/run-command";
import { spinner } from "../utils/spinner";
import { syncTools } from "../utils/sync-tools";

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

const createOptionsSchema = z.object({
	target: z.string().optional(),
	yes: z.boolean(),
	electron: z.boolean().optional(),
	fromGit: z.string().optional(),
	storageProvider: z.string().optional(),
	storageConfig: z.string().optional(),
	gateway: z.string().optional(),
	searchTool: z.string().optional(),
	urlRetrievalTool: z.string().optional(),
	imageGenerationTool: z.string().optional(),
	codeExecutionTool: z.string().optional(),
});

export const create = new Command()
	.name("create")
	.option(
		"--code-execution-tool <item>",
		"code-execution tool name or registry address",
	)
	.option("--search-tool <item>", "search tool name or registry address")
	.option(
		"--url-retrieval-tool <item>",
		"URL retrieval tool name or registry address",
	)
	.option(
		"--image-generation-tool <item>",
		"image generation tool name or registry address",
	)
	.description("scaffold a new ChatJS chat application")
	.argument("[directory]", "target directory for the project")
	.option(
		"--gateway <gateway>",
		"gateway name, registry item URL, or local JSON path",
	)
	.option("-y, --yes", "skip prompts and use defaults", false)
	.option("--electron", "include the Electron desktop app")
	.option("--no-electron", "do not include the Electron desktop app")
	.option(
		"--from-git <url>",
		"clone from a git repository instead of the built-in scaffold",
	)
	.option(
		"--storage-provider <item>",
		"storage registry item (built-in name, namespace, URL or local JSON path)",
	)
	.option(
		"--storage-config <json>",
		"non-secret JSON options for the storage adapter; credentials use env vars",
	)
	.action(async (directory, opts) => {
		try {
			const options = createOptionsSchema.parse({
				target: directory,
				...opts,
			});

			const packageManager = launcherPackageManager();

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

			const gatewaySource =
				options.gateway ?? (await promptGateway(options.yes));
			const gatewaySelection = await resolveGateway(gatewaySource, targetDir);
			const gateway = gatewaySelection.definition.id;
			const coreFeatures = await promptCoreFeatures(
				options.yes,
				gatewaySelection.definition,
			);
			const documentTypes = await promptDocumentTypes(
				options.yes,
				coreFeatures.documents,
				gatewaySelection.definition,
			);

			let registryItems: Awaited<ReturnType<typeof listTools>> = [];
			if (!options.yes) {
				const registrySpinner = spinner("Loading installable tools...");
				registrySpinner.start();
				try {
					registryItems = await listTools(targetDir);
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
				gatewaySelection.definition,
			);
			const toolSources = assistantTools.installableTools.map((tool) =>
				itemAddress(tool, "tool"),
			);
			if (assistantTools.builtInTools.deepResearch)
				assistantTools.builtInTools.webSearch = true;
			const selections = [
				{
					source: options.imageGenerationTool,
					feature: "imageGeneration",
					slot: "generateImage",
					prompt: promptImageGenerationTool,
				},
				{
					source: options.searchTool,
					feature: "webSearch",
					slot: "webSearch",
					prompt: promptSearchTool,
				},
				{
					source: options.codeExecutionTool,
					feature: "codeExecution",
					slot: "codeExecution",
					prompt: promptCodeExecutionTool,
				},
				{
					source: options.urlRetrievalTool,
					feature: "urlRetrieval",
					slot: "retrieveUrl",
					prompt: promptUrlRetrievalTool,
				},
			] as const;
			for (const selection of selections) {
				if (selection.source)
					assistantTools.builtInTools[selection.feature] = true;
				if (!assistantTools.builtInTools[selection.feature]) continue;
				const source = itemAddress(
					selection.source ?? (await selection.prompt(options.yes)),
					"tool",
				);
				const metadata = toolDefinitionSchema.parse(
					(await readItem(source, targetDir)).meta?.chatjs,
				);
				if (metadata.slot !== selection.slot)
					throw new Error(
						`Selected tool must declare the ${selection.slot} slot.`,
					);
				toolSources.push(source);
			}
			const expectedTools = [];
			for (const source of toolSources)
				expectedTools.push(
					toolDefinitionSchema.parse(
						(await readItem(source, targetDir)).meta?.chatjs,
					),
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
						targetDir,
					)
				: await resolveStorage("memory", targetDir);
			const auth = await promptAuth(options.yes);
			const withElectron = await promptElectron(options.yes, options.electron);

			logger.break();
			const scaffoldSpinner = spinner("Scaffolding project...").start();
			try {
				if (options.fromGit) {
					await scaffoldFromGit(options.fromGit, targetDir);
					if (!existsSync(join(targetDir, "lib/ai/gateway.ts"))) {
						scaffoldSpinner.succeed("Repository cloned.");
						logger.warn(
							"This repository has no ChatJS gateway slot. Skipping ChatJS configuration and installation.",
						);
						return;
					}
					if (!existsSync(join(targetDir, "lib/storage-options.ts"))) {
						throw new Error(
							"This ChatJS clone predates storage registry support. Update its storage integration before using create --from-git.",
						);
					}
					if (existsSync(join(targetDir, "tools/platform/generate-image.ts"))) {
						throw new Error(
							"This ChatJS clone uses the legacy image tool factory. Update its image registry integration before using create --from-git.",
						);
					}
					// create owns the new clone's selected gateway. Remove this one slot
					// before shadcn installs so skipping a file cannot mismatch defaults.
					await preflight(targetDir, [
						"lib/ai/gateway.ts",
						"lib/storage-provider.ts",
						"chat.config.ts",
						"package.json",
					]);
					await rm(join(targetDir, "lib/storage-provider.ts"), { force: true });
					await rm(join(targetDir, "lib/ai/gateway.ts"));
					// A fresh clone receives the requested tool selections as well.
					const toolDirectory = join(targetDir, "tools/chatjs");
					for (const entry of await readdir(toolDirectory, {
						withFileTypes: true,
					}).catch((error) => {
						if (error.code === "ENOENT") return [];
						throw error;
					})) {
						if (!entry.isDirectory()) continue;
						const descriptor = join(toolDirectory, entry.name, "chatjs.json");
						if (!existsSync(descriptor)) continue;
						await preflight(targetDir, [
							`tools/chatjs/${entry.name}/chatjs.json`,
						]);
						const metadata = toolDefinitionSchema.parse(
							JSON.parse(await readFile(descriptor, "utf8")),
						);
						if (
							metadata.slot === "webSearch" ||
							metadata.slot === "codeExecution" ||
							metadata.slot === "retrieveUrl" ||
							metadata.slot === "generateImage" ||
							(metadata.id === "retrieve-url" &&
								metadata.toolExport === "retrieveUrl")
						)
							await rm(join(toolDirectory, entry.name), { recursive: true });
					}
				} else {
					await scaffoldFromTemplate(targetDir, {
						packageManager,
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
					gatewayDefaults: gatewaySelection.definition.defaults,
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

			const installSpinner = spinner(
				"Installing selected registry items...",
			).start();
			let installedTools: Awaited<ReturnType<typeof syncTools>> = [];
			try {
				await installItems(
					[gatewaySelection.source, storage.source, ...toolSources],
					targetDir,
				);
				await configureGatewayProvider(targetDir, gatewaySelection);
				await configureStorageProvider(targetDir, storage);
				installedTools = await syncTools(targetDir, {
					expected: expectedTools,
				});
				// Also materialize scaffold dependencies when registry requirements were already declared.
				await runCommand(packageManager, ["install"], targetDir);
				// Normalize copied template imports without imposing a formatter on
				// custom clones. Generated registration indexes are excluded in Biome.
				if (!options.fromGit) {
					await runCommand(
						packageManager,
						[
							...(packageManager === "npm"
								? ["exec", "--"]
								: packageManager === "pnpm"
									? ["exec"]
									: ["run"]),
							"biome",
							"check",
							"--write",
							"--linter-enabled=false",
							".",
						],
						targetDir,
					);
				}
				installSpinner.succeed("Registry items installed and configured.");
			} catch (error) {
				installSpinner.fail(
					"Installation failed; the project may be partially installed.",
				);
				throw error;
			}
			const installableToolEnvRequirements = installedTools.flatMap(
				(tool) => tool.envRequirements,
			);

			const envEntries = collectEnvChecklist({
				gateway,
				gatewayRequirements: gatewaySelection.definition.envRequirements,
				coreFeatures,
				builtInTools: assistantTools.builtInTools,
				auth,
				installableToolEnvRequirements: [
					...installableToolEnvRequirements,
					...(usesStorage ? storage.definition.envRequirements : []),
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
			logger.log(
				`  ${highlighter.dim("3.")} ${highlighter.info(`${packageManager} run db:connect`)} then ${highlighter.info(`${packageManager} run db:push`)}`,
			);
			logger.log(
				`  ${highlighter.dim("4.")} ${highlighter.info(`${packageManager} run dev`)}`,
			);
			if (withElectron) {
				logger.break();
				logger.info("Electron desktop app:");
				logger.log(
					`  Run the web app first, then: ${highlighter.info(`cd electron && ${packageManager} install && ${packageManager} run dev`)}`,
				);
			}
			logger.break();

			printEnvChecklist(envEntries);
			logger.log(
				"  Postgres setup (Neon, Supabase, or another host): https://www.chatjs.dev/docs/reference/database",
			);
			logger.log(
				"  Optional Redis: set REDIS_URL, then run " +
					packageManager +
					" run redis:connect. Setup: https://www.chatjs.dev/docs/reference/redis",
			);

			logger.break();
			logger.log(
				`  For detailed setup instructions, visit ${highlighter.info("https://www.chatjs.dev/docs/quickstart")}`,
			);
		} catch (error) {
			handleError(error);
		}
	});
