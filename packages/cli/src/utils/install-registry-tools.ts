import fs from "node:fs/promises";
import path from "node:path";
import { log } from "@clack/prompts";
import { resolveRegistryItems } from "../registry/resolve";
import type { EnvRequirement } from "../registry/schema";
import type { PackageManager } from "../types";
import {
	createEmptyToolsTemplate,
	createEmptyUiTemplate,
	injectTool,
} from "./inject-tool";
import { installDependencies } from "./install-deps";
import { spinner } from "./spinner";
import { writeToolFiles } from "./write-files";

function isRequirementSatisfied(
	requirement: EnvRequirement,
	env: NodeJS.ProcessEnv,
): boolean {
	return requirement.options.some((option) =>
		option.every((name) => Boolean(env[name])),
	);
}

function formatRequirementDescription(requirement: EnvRequirement): string {
	return (
		requirement.description ??
		requirement.options.map((option) => option.join(" + ")).join(" or ")
	);
}

export async function installRegistryTools({
	tools,
	cwd,
	toolsDir,
	toolsAlias,
	uiDir,
	uiAlias,
	overwrite = false,
	registryUrl,
	installDependenciesNow = true,
	packageManager,
	confirmOverwrite,
}: {
	tools: string[];
	cwd: string;
	toolsDir: string;
	toolsAlias: string;
	uiDir: string;
	uiAlias: string;
	overwrite?: boolean;
	registryUrl?: string;
	installDependenciesNow?: boolean;
	packageManager?: PackageManager;
	confirmOverwrite?: (existingFiles: string[]) => Promise<boolean>;
}): Promise<{ envRequirements: EnvRequirement[] }> {
	if (tools.length === 0) {
		return { envRequirements: [] };
	}

	const toolsIndexPath = path.join(toolsDir, "tools.ts");
	const uiIndexPath = path.join(toolsDir, "ui.ts");

	const fetchSpinner = spinner(
		tools.length === 1 ? `Fetching ${tools[0]}...` : "Fetching tools...",
	);
	fetchSpinner.start();
	let resolution: Awaited<ReturnType<typeof resolveRegistryItems>>;
	try {
		resolution = await resolveRegistryItems(tools, registryUrl);
		const installsRegistryTool = resolution.items.some(
			(item) =>
				tools.includes(item.name) &&
				item.files.some(
					(file) => file.type === "tool" || file.type === "renderer",
				),
		);
		const includesRuntimeItem = resolution.items.some(
			(item) => item.name === "toolkit-renderer",
		);
		if (installsRegistryTool && !includesRuntimeItem) {
			throw new Error(
				'Registry tools must declare "toolkit-renderer" in registryDependencies',
			);
		}
		fetchSpinner.succeed(
			tools.length === 1
				? `Fetched ${tools[0]}`
				: `Fetched ${tools.length} tools`,
		);
	} catch (err) {
		fetchSpinner.fail("Failed to fetch tools");
		throw err;
	}

	const filesToWrite = resolution.files;
	const dependencies = resolution.dependencies;
	const devDependencies = resolution.devDependencies;
	const missingEnvRequirements = resolution.items.flatMap((item) =>
		(item.envRequirements ?? [])
			.filter(
				(requirement) => !isRequirementSatisfied(requirement, process.env),
			)
			.map((requirement) => ({
				tool: item.name,
				requirement: formatRequirementDescription(requirement),
			})),
	);

	let effectiveOverwrite = overwrite;
	const writeSpinner = spinner("Writing files...");
	writeSpinner.start();
	const preflight = await writeToolFiles(filesToWrite, {
		dryRun: true,
		overwrite: effectiveOverwrite,
		toolsDir,
		toolsAlias,
		uiDir,
		uiAlias,
	});

	if (preflight.existing.length > 0 && !effectiveOverwrite) {
		writeSpinner.stop();
		const shouldOverwrite = confirmOverwrite
			? await confirmOverwrite(preflight.existing)
			: false;
		if (!shouldOverwrite) {
			throw new Error(
				`Tool install would overwrite existing files. Re-run with overwrite enabled.`,
			);
		}
		effectiveOverwrite = true;
		writeSpinner.start();
	}

	const writeResult = await writeToolFiles(filesToWrite, {
		overwrite: effectiveOverwrite,
		toolsDir,
		toolsAlias,
		uiDir,
		uiAlias,
	});
	const writtenFiles = writeResult.written;
	writeSpinner.succeed(
		writtenFiles.length > 0
			? `Wrote ${writtenFiles.map((file) => path.relative(cwd, file)).join(", ")}`
			: `No file changes needed for ${tools.join(", ")}`,
	);

	if (dependencies.length > 0 || devDependencies.length > 0) {
		const depsSpinner = spinner(
			installDependenciesNow
				? "Installing dependencies..."
				: "Updating package.json dependencies...",
		);
		depsSpinner.start();
		try {
			await installDependencies(
				dependencies,
				devDependencies,
				cwd,
				installDependenciesNow,
				packageManager,
			);
			const installed = [
				...dependencies,
				...devDependencies.map((dep) => `${dep} (dev)`),
			];
			depsSpinner.succeed(
				`${installDependenciesNow ? "Installed" : "Recorded"}: ${installed.join(", ")}`,
			);
		} catch (err) {
			depsSpinner.fail(
				installDependenciesNow
					? "Failed to install dependencies"
					: "Failed to update package.json dependencies",
			);
			throw err;
		}
	}

	if (missingEnvRequirements.length > 0) {
		const details = missingEnvRequirements
			.map(({ tool, requirement }) => `${tool}: ${requirement}`)
			.join(", ");
		log.warn(`Missing env vars for installed tools: ${details}`);
	}

	const injectSpinner = spinner("Updating tool registry index...");
	injectSpinner.start();
	try {
		let toolsSource: string;
		let uiSource: string;
		try {
			toolsSource = await fs.readFile(toolsIndexPath, "utf8");
		} catch {
			toolsSource = createEmptyToolsTemplate(toolsAlias);
		}
		try {
			uiSource = await fs.readFile(uiIndexPath, "utf8");
		} catch {
			uiSource = createEmptyUiTemplate();
		}

		let updated = { toolsSource, uiSource };
		for (const name of tools) {
			const mainItem = resolution.items.find((item) => item.name === name);
			const shouldInject =
				mainItem?.files.some(
					(file) => file.type === "tool" || file.type === "renderer",
				) ?? false;
			if (!shouldInject) continue;
			updated = injectTool({
				toolsSource: updated.toolsSource,
				uiSource: updated.uiSource,
				name,
				toolsAlias,
			});
		}

		await fs.mkdir(path.dirname(toolsIndexPath), { recursive: true });
		await fs.writeFile(toolsIndexPath, updated.toolsSource, "utf8");
		await fs.writeFile(uiIndexPath, updated.uiSource, "utf8");
		injectSpinner.succeed("Updated tool registry index");
	} catch (err) {
		injectSpinner.fail("Failed to update tool registry index");
		throw err;
	}

	return {
		envRequirements: resolution.items.flatMap(
			(item) => item.envRequirements ?? [],
		),
	};
}
