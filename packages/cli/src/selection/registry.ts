import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { getRegistryItems, resolveRegistryItems } from "shadcn/registry";
import { metadataSchema, type Selection } from "./schema";

export async function withRegistry<T>(
	selection: Selection,
	action: (config: { registries: Record<string, string> }) => Promise<T>,
) {
	const directory = new URL(
		import.meta.url.endsWith("/src/selection/registry.ts")
			? "../../registry/"
			: "../registry/",
		import.meta.url,
	);
	const server = createServer(async (request, response) => {
		const match = /^\/r\/([a-z0-9-]+)\.json$/.exec(request.url ?? "");
		try {
			if (!match) throw Error("Unknown item");
			const bytes = await readFile(new URL(`${match[1]}.json`, directory));
			response.writeHead(200, { "content-type": "application/json" });
			response.end(bytes);
		} catch {
			response.writeHead(404);
			response.end();
		}
	});
	await new Promise<void>((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", resolve);
	});
	const bound = server.address();
	if (!bound || typeof bound === "string")
		throw Error("Registry listener unavailable");
	try {
		return await action({
			registries: {
				"@chatjs": `http://127.0.0.1:${bound.port}/r/{name}.json`,
				...selection.registries,
			},
		});
	} finally {
		await new Promise<void>((resolve, reject) =>
			server.close((error) => (error ? reject(error) : resolve())),
		);
	}
}

export function targetPath(target: string) {
	if (!target.startsWith("~/"))
		throw Error(
			`ChatJS composition items require explicit ~/ targets: ${target}`,
		);
	const path = target.slice(2);
	if (
		!path ||
		path.startsWith("/") ||
		path.includes("\\") ||
		path.split("/").some((part) => !part || part === "." || part === "..")
	)
		throw Error(`Unsafe registry target: ${target}`);
	return path;
}

export async function inspectSelection(
	selection: Selection,
	config: { registries: Record<string, string> },
) {
	const visited = new Set<string>();
	const originals: Awaited<ReturnType<typeof getRegistryItems>> = [];
	// Inspect semantic metadata BEFORE upstream flattening loses competing targets.
	// Upstream owns address interpretation, fetching, graph materialization and packages.
	async function inspect(address: string) {
		if (visited.has(address)) return;
		if (visited.size >= 200)
			throw Error("Selection exceeds 200 registry items");
		visited.add(address);
		const items = await getRegistryItems([address], { config });
		for (const item of items) {
			if (!item) throw Error(`Missing item: ${address}`);
			originals.push(item);
			for (const dependency of item.registryDependencies ?? [])
				await inspect(dependency);
		}
	}
	for (const address of selection.items) await inspect(address);
	const metadata = originals.map((item) =>
		metadataSchema.parse(item?.meta?.chatjs ?? {}),
	);
	const provides = new Set<string>();
	for (const entry of metadata)
		for (const capability of entry.provides) {
			if (provides.has(capability))
				throw Error(`Conflicting implementations for ${capability}`);
			provides.add(capability);
		}
	for (const entry of metadata)
		for (const required of entry.requires)
			if (!provides.has(required))
				throw Error(`Missing required integration: ${required}`);
	for (const required of [
		"next",
		"node",
		"eve",
		"bindings",
		"execution",
		"identity",
		"model",
		"layout",
	])
		if (!provides.has(required))
			throw Error(`Minimal Next requires ${required}`);
	if (
		metadata.filter((m) => m.model).length !== 1 ||
		metadata.filter((m) => m.layout).length !== 1
	)
		throw Error("Select exactly one model factory and one layout export");
	const targets = new Map<string, string>();
	const versions = new Map<string, string>();
	const protectedTargets = new Set([
		"package.json",
		"bun.lock",
		"chat.selection.json",
		"chat.config.ts",
		"chat.server.ts",
		"chat.client.ts",
		"components/chat/app-layout.tsx",
		"chat.installation.json",
	]);
	for (const item of originals) {
		if (!item) continue;
		if (item.type !== "registry:item")
			throw Error(
				`${item.name}: use a universal registry:item with explicit files for ChatJS composition`,
			);
		for (const file of item.files ?? []) {
			if (file.type !== "registry:file" || !file.target)
				throw Error(
					`${item.name}: composition files require registry:file and explicit ~/ targets`,
				);
			const target = targetPath(file.target);
			if (protectedTargets.has(target) || target.startsWith(".chatjs/"))
				throw Error(
					`Registry item cannot replace developer composition: ${target}`,
				);
			if (targets.has(target))
				throw Error(`Conflicting registry target: ${target}`);
			targets.set(target, file.content ?? "");
		}
		for (const dep of [
			...(item.dependencies ?? []),
			...(item.devDependencies ?? []),
		]) {
			const at = dep.lastIndexOf("@");
			if (at <= 0) continue;
			const name = dep.slice(0, at),
				version = dep.slice(at + 1);
			if (!/^\d+\.\d+\.\d+(?:[-+].*)?$/.test(version)) continue;
			if (versions.has(name) && versions.get(name) !== version)
				throw Error(`Conflicting exact dependency: ${name}`);
			versions.set(name, version);
		}
	}
	const mounts = metadata.flatMap((m) => m.renderers.map((r) => r.mount));
	if (new Set(mounts).size !== mounts.length)
		throw Error("Conflicting mounted renderer identities");
	const tree = await resolveRegistryItems(selection.items, { config });
	if (!tree) throw Error("Registry selection resolved to nothing");
	for (const file of tree.files ?? []) {
		const target = targetPath(file.target ?? "");
		if (!targets.has(target) || targets.get(target) !== file.content)
			throw Error(`Registry source changed during resolution: ${target}`);
	}
	return { tree, metadata, originals };
}
