import { createHash } from "node:crypto";
import {
	cp,
	lstat,
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	rename,
	rm,
	rmdir,
	symlink,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { addRegistryItems } from "shadcn/registry";
import { z } from "zod";
import pkg from "../../package.json";
import { runCommand } from "../utils/run-command";
import { inspectSelection, targetPath, withRegistry } from "./registry";
import { type Metadata, type Selection, selectionSchema } from "./schema";

export async function readSelection(input: string): Promise<Selection> {
	const raw = /^https?:\/\//.test(input)
		? await (async () => {
				const response = await fetch(input);
				if (!response.ok)
					throw Error(`Selection fetch failed: ${response.status}`);
				return response.text();
			})()
		: await readFile(resolve(input), "utf8");
	if (raw.length > 128_000) throw Error("Selection exceeds 128 KB");
	return selectionSchema.parse(JSON.parse(raw));
}

function composition(selection: Selection, metadata: Metadata[]) {
	function importRef(ref: { path: string; export: string }, local: string) {
		return ref.export === "default"
			? `import ${local} from ${JSON.stringify(ref.path)};`
			: `import { ${ref.export} as ${local} } from ${JSON.stringify(ref.path)};`;
	}
	const model = metadata.find((m) => m.model)?.model,
		layout = metadata.find((m) => m.layout)?.layout;
	if (!model || !layout) throw Error("Model/layout composition missing");
	const renderers = metadata.flatMap((m) => m.renderers),
		components = metadata.flatMap((m) => m.components);
	return new Map([
		[
			"chat.config.ts",
			`export default ${JSON.stringify(selection.settings, null, 2)};\n`,
		],
		[
			"chat.server.ts",
			`import config from "./chat.config";\n${importRef(model, "createModel")}\nexport const model = createModel(config.model);\n`,
		],
		[
			"chat.client.ts",
			`"use client";\nimport type { ComponentType } from "react";\n${renderers.map((r, i) => importRef(r, `Renderer${i}`)).join("\n")}\n${components.map((r, i) => importRef(r, `Component${i}`)).join("\n")}\nexport const renderers = {${renderers.map((r, i) => `[${JSON.stringify(r.mount)}]: Renderer${i}`).join(",")}} satisfies Record<string, ComponentType<{value: unknown}>>;\nexport const components: Record<string, ComponentType> = {${components.map((component, i) => `${JSON.stringify(`${component.path}#${component.export}`)}: Component${i}`).join(",")}};\n`,
		],
		[
			"components/chat/app-layout.tsx",
			`import type { ComponentType, ReactNode } from "react";\nimport { Chat } from "../../app/chat";\n${importRef({ ...layout, path: `../../${layout.path.slice(2)}` }, "SelectedLayout")}\nconst Layout: ComponentType<{children: ReactNode}> = SelectedLayout;\nexport default function AppLayout() { return <Layout><Chat /></Layout>; }\n`,
		],
	]);
}
async function write(cwd: string, path: string, content: string) {
	await checkNoSymlinks(cwd, path);
	await mkdir(dirname(join(cwd, path)), { recursive: true });
	await writeFile(join(cwd, path), content);
}
async function checkNoSymlinks(cwd: string, path: string) {
	let current = cwd;
	for (const part of path.split("/")) {
		current = join(current, part);
		const stat = await lstat(current).catch(() => null);
		if (stat?.isSymbolicLink()) throw Error(`Refusing symlink target: ${path}`);
	}
}
const projectPackage = (name: string) => ({
	name,
	private: true,
	type: "module",
	packageManager: "bun@1.3.11",
	engines: { node: ">=24" },
	scripts: {
		dev: "next dev",
		"eve:build": "eve build",
		"eve:start": "eve start --host 127.0.0.1",
		"test:types": "next typegen . && tsc --noEmit",
		"db:init": "bun scripts/db-init.ts",
	},
});
const hash = (content: string) =>
	createHash("sha256").update(content).digest("hex");

export async function installSelection(
	selection: Selection,
	target: string,
	mode: "create" | "add",
) {
	const cwd = resolve(target);
	if ((await lstat(cwd).catch(() => null))?.isSymbolicLink())
		throw Error("Project target cannot be a symlink");
	if (mode === "create" && (await readdir(cwd).catch(() => [])).length)
		throw Error("Create requires an empty target directory");
	const parent = mode === "create" ? dirname(cwd) : tmpdir();
	await mkdir(parent, { recursive: true });
	const stage = await mkdtemp(join(parent, ".chatjs-install-"));
	try {
		return await withRegistry(selection, async (config) => {
			const { tree, metadata, originals } = await inspectSelection(
				selection,
				config,
			);
			const desired = composition(selection, metadata);
			// Public upstream resolver produces the snapshot passed to public materialization.
			// This temporary standard item is not a new registry lock/version format.
			const snapshot = join(stage, "resolved.json");
			const app = mode === "create" ? join(stage, "app") : cwd;
			await mkdir(app, { recursive: true });
			const previousFiles =
				mode === "add"
					? z
							.object({ fileHashes: z.record(z.string(), z.string()) })
							.parse(
								JSON.parse(
									await readFile(join(app, "chat.installation.json"), "utf8"),
								),
							).fileHashes
					: {};
			const fileHashes: Record<string, string> = {};
			if (mode === "create")
				await write(
					app,
					"package.json",
					JSON.stringify(
						projectPackage(cwd.split(/[\\/]/).pop() ?? "chat-app"),
						null,
						2,
					),
				);
			for (const file of tree.files ?? []) {
				const path = targetPath(file.target ?? "");
				await checkNoSymlinks(app, path);
				const content = file.content ?? "";
				fileHashes[path] = hash(content);
				// Re-propose changed registry source, but never revert local edits when
				// that item's source has not changed since the adopted receipt.
				if (mode === "add" && previousFiles[path] !== fileHashes[path])
					desired.set(path, content);
			}
			for (const path of [
				"package.json",
				"bun.lock",
				"bun.lockb",
				".env.local",
				"node_modules",
			])
				await checkNoSymlinks(app, path);
			await writeFile(
				snapshot,
				JSON.stringify({
					$schema: "https://ui.shadcn.com/schema/registry-item.json",
					name: "selected-chatjs-app",
					type: "registry:item",
					...tree,
				}),
			);
			await addRegistryItems([snapshot], {
				cwd: app,
				overwrite: false,
				silent: true,
			});
			if (mode === "add") {
				await checkNoSymlinks(app, ".chatjs/proposals");
				await rm(join(app, ".chatjs/proposals"), {
					recursive: true,
					force: true,
				});
			}
			const proposals: string[] = [];
			for (const [path, content] of desired) {
				await checkNoSymlinks(app, path);
				const existing = await readFile(join(app, path), "utf8").catch(
					() => null,
				);
				if (mode === "add" && existing !== null && existing !== content) {
					await write(app, `.chatjs/proposals/${path}`, content);
					proposals.push(path);
				} else if (existing === null) await write(app, path, content);
			}
			const provenance = {
				cli: pkg.version,
				items: selection.items,
				fileHashes,
				observedSources: originals
					.filter((item) => item !== null)
					.map((item) => ({
						name: item.name,
						sha256: createHash("sha256")
							.update(JSON.stringify(item))
							.digest("hex"),
					})),
			};
			if (mode === "create") {
				await write(
					app,
					"chat.selection.json",
					`${JSON.stringify(selection, null, 2)}\n`,
				);
				await write(
					app,
					"chat.installation.json",
					`${JSON.stringify(provenance, null, 2)}\n`,
				);
				await write(
					app,
					".gitignore",
					"node_modules\n.next\n.eve\n.env.local\n.chatjs\n",
				);
			} else {
				await write(
					app,
					".chatjs/proposals/chat.selection.json",
					`${JSON.stringify(selection, null, 2)}\n`,
				);
				await write(
					app,
					".chatjs/proposals/chat.installation.json",
					`${JSON.stringify(provenance, null, 2)}\n`,
				);
			}
			const setup = `# Selected ChatJS app\n\nRequires Node 24+, Bun and a configured durable backend. Fill the selected placeholders in .env.local; keep that file private. Generate independent APP_IDENTITY_SECRET and EVE_GATEWAY_SECRET values. The example host verifier expects a signed credential; no login UI is installed.\n\n${originals
				.map((item) => item?.docs ?? "")
				.filter(Boolean)
				.join(
					"\n\n",
				)}\n\nAfter backend setup:\n\n\`\`\`sh\nnode --env-file=.env.local node_modules/eve/bin/eve.js build\nnode --env-file=.env.local node_modules/eve/bin/eve.js start --host 127.0.0.1 --port 3001\n# In another terminal:\nbun run dev\n\`\`\`\n\nExpose only Next to callers. Eve is a private worker. Creation with an ambiguous outcome fails closed and requires reconciliation; cancellation is cooperative. This is not a validated deployment recipe.\n\nDeveloper source is authoritative. Additions place proposed composition under .chatjs/proposals; compare each file with git diff --no-index before copying selected edits. Never blindly copy the entire proposals directory. Run bun run test:types after adopting edits. Installing source is not proof required service setup works.\n`;
			await write(
				app,
				mode === "create" ? "SETUP.md" : ".chatjs/proposals/SETUP.md",
				setup,
			);
			if (mode === "add") {
				const preview = join(stage, "preview");
				await cp(app, preview, {
					recursive: true,
					filter: async (source) => {
						const relative = source
							.slice(app.length)
							.split(/[\\/]/)
							.filter(Boolean);
						if (
							relative.some(
								(part) =>
									["node_modules", ".git", ".next", ".eve", ".chatjs"].includes(
										part,
									) || part.startsWith(".env"),
							)
						)
							return false;
						return !(await lstat(source)).isSymbolicLink();
					},
				});
				await symlink(
					join(app, "node_modules"),
					join(preview, "node_modules"),
					"dir",
				);
				for (const [path, content] of desired)
					await write(preview, path, content);
				await runCommand("bun", ["run", "test:types"], preview);
			}
			if (mode === "create") {
				await runCommand("bun", ["run", "test:types"], app);
				await rmdir(cwd).catch((error: NodeJS.ErrnoException) => {
					if (error.code !== "ENOENT") throw error;
				});
				await rename(app, cwd);
			}
			return {
				proposals,
				setup: mode === "create" ? "SETUP.md" : ".chatjs/proposals/SETUP.md",
			};
		});
	} finally {
		await rm(stage, { recursive: true, force: true });
	}
}
