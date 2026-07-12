import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	getProvider,
	PROVIDER_NAMES,
	type ProviderSlug,
} from "files-sdk/providers";
import { z } from "zod";
import { getStorageEnvironmentRequirements } from "../../../../apps/chat/lib/storage-provider-metadata";

export type StorageSelection = {
	provider: ProviderSlug;
	options: Record<string, unknown>;
};

const STORAGE_ENV_START = "# <chatjs-storage-provider>";
const STORAGE_ENV_END = "# </chatjs-storage-provider>";
const STORAGE_PEERS_PREFIX = "// ChatJS storage peer dependencies: ";
const UNSUPPORTED_SCAFFOLD_PROVIDERS = new Set<ProviderSlug>([
	"box",
	"bun-s3",
	"convex",
	"fs",
	"memory",
]);
const packageManifestSchema = z
	.object({
		dependencies: z.record(z.string(), z.string()).optional(),
	})
	.loose();
const filesSdkPackageSchema = z
	.object({
		peerDependencies: z.record(z.string(), z.string()).optional(),
	})
	.loose();
const storageOptionsSchema = z.record(z.string(), z.unknown());

export const INSTALLABLE_STORAGE_PROVIDERS = PROVIDER_NAMES.filter(
	(provider) => !UNSUPPORTED_SCAFFOLD_PROVIDERS.has(provider),
);

export function parseStorageOptions(value: string): Record<string, unknown> {
	let parsed: unknown;
	try {
		parsed = JSON.parse(value);
	} catch {
		throw new Error("Storage config must be a valid JSON object.");
	}
	const result = storageOptionsSchema.safeParse(parsed);
	if (!result.success) {
		throw new Error("Storage config must be a JSON object.");
	}
	return result.data;
}

function isProviderSlug(value: string): value is ProviderSlug {
	return PROVIDER_NAMES.some((provider) => provider === value);
}

export function resolveStorageProvider(value: string): ProviderSlug {
	if (!isProviderSlug(value)) {
		throw new Error(`Unknown Files SDK provider: ${value}`);
	}
	if (UNSUPPORTED_SCAFFOLD_PROVIDERS.has(value)) {
		throw new Error(
			`Provider "${value}" is not supported for generated Next.js apps. Choose one of: ${INSTALLABLE_STORAGE_PROVIDERS.join(", ")}.`,
		);
	}
	return value;
}

export function storageEnvRequirements(
	provider: ProviderSlug,
	options: Record<string, unknown> = {},
): Array<{
	description: string;
	options: string[][];
}> {
	return getStorageEnvironmentRequirements(provider, options).map(
		(requirement) => ({
			description: requirement.description,
			options: requirement.options.map((option) =>
				option.map(({ key }) => key),
			),
		}),
	);
}

function findFilesSdkPackageJson(): string {
	let current = dirname(fileURLToPath(import.meta.resolve("files-sdk")));
	while (dirname(current) !== current) {
		const candidate = join(current, "package.json");
		if (existsSync(candidate)) {
			return candidate;
		}
		current = dirname(current);
	}
	throw new Error("Could not locate the files-sdk package manifest.");
}

function renderEnvVariable(
	variable: { description: string; key: string },
	optional = false,
): string[] {
	return optional
		? [`# ${variable.key}= # ${variable.description}`]
		: [`# ${variable.description}`, `${variable.key}=`];
}

export function getProviderFactoryName(provider: ProviderSlug): string {
	return provider.replace(/-([a-z0-9])/g, (_, character: string) =>
		character.toUpperCase(),
	);
}

async function getGeneratedStoragePeers(destination: string): Promise<string[]> {
	const providerPath = join(destination, "lib", "storage-provider.ts");
	if (!existsSync(providerPath)) {
		return [];
	}
	const source = await readFile(providerPath, "utf8");
	const marker = source
		.split("\n")
		.find((line) => line.startsWith(STORAGE_PEERS_PREFIX));
	if (!marker) {
		return [];
	}
	try {
		const parsed = z
			.array(z.string())
			.safeParse(JSON.parse(marker.slice(STORAGE_PEERS_PREFIX.length)));
		return parsed.success ? parsed.data : [];
	} catch {
		return [];
	}
}

export async function configureStorageProvider(
	destination: string,
	selection: StorageSelection,
): Promise<void> {
	const metadata = getProvider(selection.provider);
	if (!metadata) {
		throw new Error(`Unknown Files SDK provider: ${selection.provider}`);
	}

	const sdkPackage = filesSdkPackageSchema.parse(
		JSON.parse(await readFile(findFilesSdkPackageJson(), "utf8")),
	);
	const packagePath = join(destination, "package.json");
	const packageJson = packageManifestSchema.parse(
		JSON.parse(await readFile(packagePath, "utf8")),
	);
	const existing = packageJson.dependencies ?? {};
	const generatedPeers = new Set(await getGeneratedStoragePeers(destination));
	const dependencies = Object.fromEntries(
		Object.entries(existing).filter(([name]) => !generatedPeers.has(name)),
	);
	for (const peer of metadata.peerDeps) {
		const version = sdkPackage.peerDependencies?.[peer];
		if (!version) {
			throw new Error(`No files-sdk peer version found for ${peer}`);
		}
		dependencies[peer] = existing[peer] ?? version;
	}
	packageJson.dependencies = dependencies;
	await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

	const factoryName = getProviderFactoryName(selection.provider);
	const providerSource = `// Generated by ChatJS. Re-run the installer to switch providers.
${STORAGE_PEERS_PREFIX}${JSON.stringify(metadata.peerDeps)}

import type { ProviderSlug } from "files-sdk/providers";
import { ${factoryName} } from "files-sdk/${selection.provider}";

const options = ${JSON.stringify(selection.options, null, 2)} satisfies Parameters<typeof ${factoryName}>[0];

export const storageProvider = {
  createAdapter: () => ${factoryName}(options),
  options,
  slug: "${selection.provider}",
} satisfies {
  createAdapter: () => ReturnType<typeof ${factoryName}>;
  options: typeof options;
  slug: ProviderSlug;
};
`;
	await writeFile(
		join(destination, "lib", "storage-provider.ts"),
		providerSource,
	);

	const envPath = join(destination, ".env.example");
	if (!existsSync(envPath)) {
		return;
	}
	const env = await readFile(envPath, "utf8");
	const start = env.indexOf(STORAGE_ENV_START);
	const end = env.indexOf(STORAGE_ENV_END);
	if (start === -1 || end <= start) {
		return;
	}

	const requirements = getStorageEnvironmentRequirements(
		selection.provider,
		selection.options,
	);
	const lines = [
		STORAGE_ENV_START,
		`# ${metadata.name}: ${metadata.description}`,
		...requirements.flatMap((requirement) => [
			`# ${requirement.description}${requirement.options.length > 1 ? " (choose one)" : ""}`,
			...requirement.options.flatMap((option, index) => [
				...(requirement.options.length > 1 ? [`# Option ${index + 1}`] : []),
				...option.flatMap((variable) => renderEnvVariable(variable)),
			]),
		]),
		...(metadata.env.optional ?? []).flatMap((variable) =>
			renderEnvVariable(variable, true),
		),
		...(metadata.env.notes ? [`# Note: ${metadata.env.notes}`] : []),
		STORAGE_ENV_END,
	];
	const updated = `${env.slice(0, start)}${lines.join("\n")}${env.slice(end + STORAGE_ENV_END.length)}`;
	await writeFile(envPath, updated);
}
