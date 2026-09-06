import fs from "node:fs/promises";
import path from "node:path";
import { confirm, intro, isCancel, log, outro } from "@clack/prompts";
import { Command } from "commander";
import { loadProjectConfig, resolveToolsPath } from "../utils/get-config";
import { handleError } from "../utils/handle-error";
import { installRegistryTools } from "../utils/install-registry-tools";
import { spinner } from "../utils/spinner";
import { addSelected } from "../selection/commands";

export const add = new Command()
	.name("add")
	.description(
		"add registry items to a selected app, or tools to a legacy ChatJS project",
	)
	.option(
		"--selection <file-or-url>",
		"propose a complete updated shared selection",
	)
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
			const selected = await fs
				.stat(path.join(cwd, "chat.selection.json"))
				.then(
					() => true,
					() => false,
				);
			if (selected) {
				if (!tools.length && !opts.selection)
					throw new Error("Specify item addresses or --selection.");
				if (opts.overwrite || opts.registry)
					throw new Error(
						"Selected apps preserve edits; use registry addresses/selection and review .chatjs/proposals.",
					);
				await addSelected(cwd, tools, opts.selection);
				return;
			}
			if (opts.selection)
				throw new Error(
					"Shared selection additions require an app created with --minimal or --selection.",
				);

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

			intro("chatjs add");

			const configSpinner = spinner("Loading project config...");
			configSpinner.start();
			let config: { paths: { tools: string } };
			try {
				config = await loadProjectConfig(cwd);
				configSpinner.succeed("Project config loaded");
			} catch (err) {
				configSpinner.fail("Failed to load project config");
				throw err;
			}

			const toolsDir = resolveToolsPath(config.paths.tools, cwd);

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
