import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

// Native upstream registry items. No custom descriptor/resolver/installer.
const source = (name: string) => Bun.file(join(import.meta.dir, name)).text();
const provider =
	'import { Files } from "files-sdk";\nimport { memory } from "files-sdk/memory";\nexport function createFiles(_root: string) { return new Files({ adapter: memory(), retries: 0 }); }\n';
const externalEditor = (await source("text-editor.tsx"))
	.replace(
		"import { useState }",
		'import diff from "fast-diff";\nimport { useState }',
	)
	.replace(
		"<label>",
		'<p aria-label="Change count">{diff(value.content, draft).filter(([operation]) => operation !== 0).length} changes</p><label>',
	);
const items = {
	files: {
		dependencies: ["files-sdk@2.1.0"],
		files: {
			"files.server.ts": await source("files.server.ts"),
			"storage.server.ts": await source("storage.server.ts"),
		},
	},
	"external-storage": {
		dependencies: ["files-sdk@2.1.0"],
		files: {
			"files.server.ts": await source("files.server.ts"),
			"storage.server.ts": provider,
		},
	},
	"external-renderer": {
		dependencies: ["react@19.2.4", "zod@4.3.6"],
		files: {
			"contract.ts": await source("contract.ts"),
			"result-renderer.tsx": (await source("result-renderer.tsx")).replace(
				"Open exact revision",
				"Inspect saved revision",
			),
		},
	},
	text: {
		dependencies: ["zod@4.3.6"],
		files: {
			"contract.ts": await source("contract.ts"),
			"documents.server.ts": await source("documents.server.ts"),
		},
	},
	"external-editor": {
		dependencies: ["react@19.2.4", "fast-diff@1.3.0", "zod@4.3.6"],
		files: {
			"contract.ts": await source("contract.ts"),
			"text-editor.tsx": externalEditor,
		},
	},
};
const names = z.enum([
	"files",
	"external-storage",
	"text",
	"external-renderer",
	"external-editor",
]);
const server = Bun.serve({
	hostname: "127.0.0.1",
	port: 0,
	fetch(request) {
		const name = names.safeParse(
			new URL(request.url).pathname.slice(1).replace(/\.json$/, ""),
		);
		if (!name.success) return new Response(null, { status: 404 });
		const item = items[name.data];
		return Response.json({
			$schema: "https://ui.shadcn.com/schema/registry-item.json",
			name: name.data,
			type: "registry:item",
			dependencies: item.dependencies,
			files: Object.entries(item.files).map(([path, content]) => ({
				path,
				content,
				type: "registry:file",
				target: `~/src/${path}`,
			})),
		});
	},
});
const root = await mkdtemp(join(tmpdir(), "selected-registry-"));
const results: unknown[] = [];
try {
	for (const name of ["minimal", ...names.options]) {
		const dir = join(root, name);
		await Bun.write(
			join(dir, "package.json"),
			JSON.stringify({
				name: `fixture-${name}`,
				private: true,
				type: "module",
				dependencies: {},
				devDependencies: {
					typescript: "6.0.2",
					"@types/bun": "1.3.12",
					"@types/react": "19.2.18",
				},
			}),
		);
		// Select Bun for the real shadcn dependency installation.
		let child = Bun.spawn(["bun", "install"], {
			cwd: dir,
			stdout: "pipe",
			stderr: "pipe",
		});
		if ((await child.exited) !== 0)
			throw new Error(await new Response(child.stderr).text());
		if (name !== "minimal") {
			child = Bun.spawn(
				[
					"bunx",
					"--bun",
					"shadcn@4.18.0",
					"add",
					new URL(`/${name}.json`, server.url).href,
					"--yes",
					"--cwd",
					dir,
				],
				{ stdout: "pipe", stderr: "pipe" },
			);
			const stdout = new Response(child.stdout).text();
			const stderr = new Response(child.stderr).text();
			const code = await child.exited;
			if (code !== 0)
				throw new Error(`${name}: ${await stdout}\n${await stderr}`);
		}
		if (await Bun.file(join(dir, "package-lock.json")).exists())
			throw new Error("Installer did not use Bun");
		await Bun.write(
			join(dir, "tsconfig.json"),
			JSON.stringify({
				compilerOptions: {
					target: "ESNext",
					module: "Preserve",
					moduleResolution: "Bundler",
					strict: true,
					noEmit: true,
					skipLibCheck: true,
					jsx: "react-jsx",
					types: ["bun", "react"],
				},
				include: ["src/**/*.ts", "src/**/*.tsx", "verify.ts"],
			}),
		);
		const manifest = z
			.object({ dependencies: z.record(z.string(), z.string()).default({}) })
			.parse(await Bun.file(join(dir, "package.json")).json());
		const installed = await Array.fromAsync(
			new Bun.Glob("src/*").scan({ cwd: dir }),
		);
		const lock = (await Bun.file(join(dir, "bun.lock")).exists())
			? await Bun.file(join(dir, "bun.lock")).text()
			: "";
		if (!lock) throw new Error("Missing Bun lockfile");
		if (
			name === "minimal" &&
			(installed.length || Object.keys(manifest.dependencies).length)
		)
			throw new Error("Minimal polluted");
		if (
			!name.includes("storage") &&
			name !== "files" &&
			(manifest.dependencies["files-sdk"] || lock.includes('"files-sdk"'))
		)
			throw new Error("Unselected Files SDK installed");
		if (
			name !== "external-editor" &&
			(manifest.dependencies["fast-diff"] || lock.includes('"fast-diff"'))
		)
			throw new Error("Unselected editor dependency installed");
		if (
			manifest.dependencies["@vercel/blob"] ||
			manifest.dependencies["@aws-sdk/client-s3"]
		)
			throw new Error("Unselected provider peer");
		for (const peer of ["@vercel/blob", "@aws-sdk/client-s3"]) {
			if (
				await Bun.file(join(dir, "node_modules", peer, "package.json")).exists()
			)
				throw new Error(`Unselected provider peer installed: ${peer}`);
		}
		if (name === "external-storage") {
			await Bun.write(
				join(dir, "verify.ts"),
				'import { createFiles } from "./src/storage.server"; const files = createFiles("unused"); await files.upload("proof", "external native adapter"); if (await (await files.download("proof")).text() !== "external native adapter") throw new Error("External adapter failed");',
			);
			const proof = Bun.spawn(["bun", "verify.ts"], {
				cwd: dir,
				stdout: "pipe",
				stderr: "pipe",
			});
			if ((await proof.exited) !== 0)
				throw new Error(await new Response(proof.stderr).text());
		}
		if (name === "external-renderer") {
			const build = await Bun.build({
				entrypoints: [join(dir, "src/result-renderer.tsx")],
				target: "browser",
			});
			if (
				!build.success ||
				!(await build.outputs[0]?.text())?.includes("Inspect saved revision")
			)
				throw new Error("External renderer did not replace selected component");
		}
		if (name === "external-editor") {
			const build = await Bun.build({
				entrypoints: [join(dir, "src/text-editor.tsx")],
				target: "browser",
			});
			if (
				!build.success ||
				!(await build.outputs[0]?.text())?.includes("Change count")
			)
				throw new Error("External editor bundle failed");
		}
		if (name !== "minimal") {
			const check = Bun.spawn(
				["bun", "node_modules/typescript/bin/tsc", "--noEmit"],
				{ cwd: dir, stdout: "pipe", stderr: "pipe" },
			);
			const output = new Response(check.stdout).text();
			const errors = new Response(check.stderr).text();
			if ((await check.exited) !== 0)
				throw new Error(`${name}: ${await output} ${await errors}`);
		}
		const versions: Record<string, string> = {};
		for (const dependency of Object.keys(manifest.dependencies)) {
			versions[dependency] = z
				.object({ version: z.string() })
				.parse(
					await Bun.file(
						join(dir, "node_modules", dependency, "package.json"),
					).json(),
				).version;
		}
		results.push({
			name,
			installed,
			dependencies: manifest.dependencies,
			resolvedVersions: versions,
			lockfile: Boolean(lock),
			nativeInstall: name !== "minimal",
		});
	}
	console.log(JSON.stringify({ shadcn: "4.18.0", results }, null, 2));
} finally {
	await server.stop(true);
	await rm(root, { recursive: true, force: true });
}
