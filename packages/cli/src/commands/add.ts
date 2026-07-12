import fs from "node:fs/promises";
import path from "node:path";
import { confirm, intro, isCancel, log, outro } from "@clack/prompts";
import { Command } from "commander";
import {
	loadProjectConfig,
	loadProjectUiConfig,
	resolveProjectPath,
} from "../utils/get-config";
import { handleError } from "../utils/handle-error";
import { installRegistryTools } from "../utils/install-registry-tools";
import { spinner } from "../utils/spinner";

export const add = new Command()
	.name("add")
	.description("add a tool to an existing ChatJS project")
	.argument("[tools...]", "tool names to add (e.g. word-count)")
	.option("-y, --yes", "skip confirmation prompt", false)
	.option(
		"-o, --overwrite",
		"overwrite existing files without prompting",
		false,
	)
	.option(
		"-c, --cwd <cwd>",
		"the working directory (defaults to current directory)",
		process.cwd(),
	)
	.option(
		"-r, --registry <url>",
		"registry URL or local path template (e.g. ./packages/registry/items/{name}.json)",
	)
	.action(async (tools: string[], opts) => {
		try {
			const cwd = path.resolve(opts.cwd);

			if (tools.length === 0) {
				log.error(
					"Please specify one or more tool names, e.g. chatjs add word-count",
				);
				process.exit(1);
			}

			try {
				await fs.stat(path.join(cwd, "chat.config.ts"));
			} catch {
				log.error(
					"No chat.config.ts found. Run `chat-js create` first or specify --cwd.",
				);
				process.exit(1);
			}

			try {
				await fs.stat(path.join(cwd, "components.json"));
			} catch {
				log.error(
					'No components.json found. Add one with an "aliases.ui" entry or re-run `chat-js create`.',
				);
				process.exit(1);
			}

			intro("chatjs add");

			const configSpinner = spinner("Loading project config...");
			configSpinner.start();
			let config: { paths: { tools: string } };
			let uiConfig: { alias: string };
			try {
				[config, uiConfig] = await Promise.all([
					loadProjectConfig(cwd),
					loadProjectUiConfig(cwd),
				]);
				configSpinner.succeed("Project config loaded");
			} catch (err) {
				configSpinner.fail("Failed to load project config");
				throw err;
			}

			const [toolsDir, uiDir] = await Promise.all([
				resolveProjectPath(config.paths.tools, cwd),
				resolveProjectPath(uiConfig.alias, cwd),
			]);

			if (!opts.yes) {
				const answer = await confirm({
					message: `Install ${tools.join(", ")} into ${path.relative(process.cwd(), toolsDir)}/?`,
				});
				if (isCancel(answer) || !answer) {
					outro("Cancelled.");
					process.exit(0);
				}
			}

			await installRegistryTools({
				tools,
				cwd,
				toolsDir,
				toolsAlias: config.paths.tools,
				uiDir,
				uiAlias: uiConfig.alias,
				overwrite: opts.overwrite as boolean,
				registryUrl: opts.registry,
				confirmOverwrite: async (existingFiles) => {
					const answer = await confirm({
						message: `${existingFiles
							.map((file) => path.relative(cwd, file))
							.join(", ")} already exist. Overwrite?`,
					});
					return !(isCancel(answer) || !answer);
				},
			});

			outro(
				`Done! ${tools.length === 1 ? `"${tools[0]}"` : `${tools.length} tools`} installed successfully.`,
			);
		} catch (error) {
			handleError(error);
		}
	});
