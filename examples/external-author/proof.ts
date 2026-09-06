import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { authorItems } from "./registry";

const repo = resolve(import.meta.dir, "../..");
await mkdir(join(repo, ".local-research"), { recursive: true });
const root = process.env.AUTHOR_OUTPUT
	? resolve(process.env.AUTHOR_OUTPUT)
	: await mkdtemp(join(repo, ".local-research/external-author-"));
const cli = join(repo, "packages/cli/dist/index.js");
const pin = await Bun.file(join(import.meta.dir, "PIN.json")).json();
export async function command(
	args: string[],
	cwd: string,
	extra: Record<string, string> = {},
	mustPass = true,
) {
	const proc = Bun.spawn(args, {
		cwd,
		env: { ...process.env, ...extra },
		stdout: "pipe",
		stderr: "pipe",
	});
	const [code, out, err] = await Promise.all([
		proc.exited,
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
	]);
	if (mustPass) assert.equal(code, 0, `${args.join(" ")}\n${out}\n${err}`);
	return { code, out, err };
}
const head = (await command(["git", "rev-parse", "HEAD"], repo)).out.trim();
await command(["git", "merge-base", "--is-ancestor", pin.head, head], repo);
// The executable's implementation files must still be exactly the review pin.
assert.equal(
	(
		await command(
			["git", "diff", pin.head, "--", "packages/cli", "examples/minimal-next"],
			repo,
		)
	).out,
	"",
	"Installer or starter differs from recorded pin",
);
await command(["bun", "run", "build"], join(repo, "packages/cli"));
await mkdir(root, { recursive: true });
const items = await authorItems();
const selections: Record<string, unknown> = {};
const server = Bun.serve({
	hostname: "127.0.0.1",
	port: 0,
	fetch(request) {
		const path = new URL(request.url).pathname;
		if (path.startsWith("/selection/"))
			return Response.json(selections[path.slice(11)]);
		const name = path.slice(3).replace(/\.json$/, "");
		return Object.hasOwn(items, name)
			? Response.json(items[name as keyof typeof items])
			: new Response("Not found", { status: 404 });
	},
});
const external = (name: string) => `${server.url.origin}/r/${name}.json`;
const shared = [
	"@chatjs/minimal-next",
	"@chatjs/host-identity",
	"@chatjs/postgres",
];
selections.studio = {
	items: [
		...shared,
		external("gateway"),
		external("svg"),
		external("search"),
		external("scratchpad"),
		external("layout"),
	],
	settings: { model: "gpt-5-mini" },
};
selections.frontend = {
	items: [
		...shared,
		"@chatjs/openai",
		external("scratchpad"),
		external("layout"),
	],
	settings: { model: "gpt-5-mini" },
};
selections.search = {
	items: [
		...shared,
		"@chatjs/openai",
		"@chatjs/layout-minimal",
		external("search"),
	],
	settings: { model: "gpt-5-mini" },
};
const evidence: Record<string, unknown> = {
	pin,
	sourceBranchHead: head,
	scope:
		"Real built CLI, generated source and local conformance; live run is separate",
	cases: [],
};
try {
	for (const name of ["studio", "frontend", "search"]) {
		const app = join(root, name);
		assert(
			!(await Bun.file(join(app, "package.json")).exists()),
			`Use a fresh AUTHOR_OUTPUT: ${app} already exists`,
		);
		await command(
			[
				"node",
				cli,
				"create",
				app,
				"--selection",
				`${server.url.origin}/selection/${name}`,
				"--yes",
			],
			repo,
		);
		const pkg = await Bun.file(join(app, "package.json")).json();
		// Check physical source omission, not just the generated import map. These
		// checks run before `add`, which intentionally installs SVG into frontend.
		const sourceGroups = [
			{
				selected: name === "studio",
				paths: ["integrations/author/gateway.ts"],
			},
			{
				selected: name !== "studio",
				paths: ["integrations/model.ts"],
			},
			{
				selected: name === "studio",
				paths: [
					"agent/tools/draw_svg.ts",
					"lib/author-svg-contract.ts",
					"components/author-svg/client.tsx",
					"components/author-svg/renderer.tsx",
				],
			},
			{
				selected: name !== "frontend",
				paths: [
					"agent/tools/author_search.ts",
					"lib/author-search-contract.ts",
					"lib/author-search.server.ts",
					"components/author-search/client.tsx",
					"components/author-search/renderer.tsx",
				],
			},
			{
				selected: name !== "search",
				paths: [
					"components/author/scratchpad.tsx",
					"components/author/studio-layout.tsx",
				],
			},
			{
				selected: name === "search",
				paths: ["components/chat/layout-minimal.tsx"],
			},
			{
				selected: false,
				paths: [
					"agent/tools/confirm_note.ts",
					"lib/note-contract.ts",
					"components/confirm-note/client.tsx",
					"components/confirm-note/renderer.tsx",
				],
			},
		];
		for (const group of sourceGroups)
			for (const path of group.paths)
				assert.equal(
					await Bun.file(join(app, path)).exists(),
					group.selected,
					`${name}: ${path} must be ${group.selected ? "present" : "absent"}`,
				);
		// app-layout.tsx is generated composition glue in every selection.
		const layout = await readFile(
			join(app, "components/chat/app-layout.tsx"),
			"utf8",
		);
		assert.equal(
			layout.includes("../../components/author/studio-layout"),
			name !== "search",
		);
		assert.equal(
			layout.includes("../../components/chat/layout-minimal"),
			name === "search",
		);
		const client = await readFile(join(app, "chat.client.ts"), "utf8");
		for (const [mount, included] of [
			["draw_svg", name === "studio"],
			["author_search", name !== "frontend"],
			["Scratchpad", name !== "search"],
		] as const)
			assert.equal(client.includes(mount), included, `${name}: ${mount} mount`);
		const modelSource = await readFile(join(app, "chat.server.ts"), "utf8");
		assert.equal(
			modelSource.includes("./integrations/author/gateway"),
			name === "studio",
		);
		assert.equal(
			modelSource.includes('"./integrations/model"'),
			name !== "studio",
		);
		// Built-in tool files are required disable stubs, not omitted files.
		assert.match(
			await readFile(join(app, "agent/tools/web_search.ts"), "utf8"),
			/^import \{ disableTool \} from "eve\/tools";\s+export default disableTool\(\);\s*$/,
		);
		const lock = Bun.JSONC.parse(
			await readFile(join(app, "bun.lock"), "utf8"),
		) as {
			workspaces: Record<string, { dependencies: Record<string, string> }>;
			packages: Record<
				string,
				[
					string,
					string,
					{ dependencies?: Record<string, string> },
					...unknown[],
				]
			>;
		};
		assert.deepEqual(
			lock.workspaces[""].dependencies,
			pkg.dependencies,
			`${name}: installed root dependencies must match package.json`,
		);
		const exclusiveDependencies = [
			"@ai-sdk/openai-compatible",
			"files-sdk",
			"@vercel/sandbox",
			"@tavily/core",
			"@mendable/firecrawl-js",
			"papaparse",
		];
		// Inspect package resolutions too, including nested package keys. A
		// direct-dependency-only check would miss an accidentally bundled add-on.
		const resolvedPackages = Object.values(lock.packages);
		for (const dependency of exclusiveDependencies) {
			assert(!pkg.dependencies[dependency], `${name}: direct ${dependency}`);
			assert(!pkg.devDependencies?.[dependency], `${name}: dev ${dependency}`);
			assert(
				!resolvedPackages.some(([resolution]) =>
					resolution.startsWith(`${dependency}@`),
				),
				`${name}: unselected ${dependency} appears in bun.lock`,
			);
		}
		// Eve and AI SDK retain their own transitives regardless of selection.
		// Their presence is not evidence that an unselected registry was installed.
		const retainedTransitives = ["nitro", "undici", "@ai-sdk/gateway"];
		for (const dependency of retainedTransitives) {
			assert(!pkg.dependencies[dependency]);
			assert(
				resolvedPackages.some(([resolution]) =>
					resolution.startsWith(`${dependency}@`),
				),
			);
		}
		assert(lock.packages.eve?.[2].dependencies?.nitro);
		assert(lock.packages.eve?.[2].dependencies?.undici);
		assert(lock.packages.ai?.[2].dependencies?.["@ai-sdk/gateway"]);
		const omission = {
			presentSources: sourceGroups
				.filter((group) => group.selected)
				.flatMap((group) => group.paths),
			absentSources: sourceGroups
				.filter((group) => !group.selected)
				.flatMap((group) => group.paths),
			absentDirectAndResolvedDependencies: exclusiveDependencies,
			retainedTransitives,
			rootLockDependenciesMatchManifest: true,
			builtinWebSearch:
				"disableTool stub; no built-in search implementation selected",
		};
		await command(["node", "node_modules/eve/bin/eve.js", "build"], app, {
			APP_DATABASE_URL: "postgres://fixture:fixture@127.0.0.1:1/unused",
		});
		const tools = (
			await Bun.file(join(app, ".eve/agent-summary.json")).json()
		).tools
			.map((tool: { name: string }) => tool.name)
			.sort();
		assert.deepEqual(
			tools,
			name === "studio"
				? ["author_search", "draw_svg"]
				: name === "search"
					? ["author_search"]
					: [],
		);
		const selected = JSON.parse(
			await readFile(join(app, "chat.installation.json"), "utf8"),
		);
		(evidence.cases as unknown[]).push({
			name,
			dependencies: pkg.dependencies,
			omission,
			tools,
			receipt: selected,
		});
		if (name === "studio") {
			await cp(
				join(import.meta.dir, "conformance.tsx"),
				join(app, "conformance.tsx"),
			);
			await command(["bun", "conformance.tsx"], app);
			await cp(join(import.meta.dir, "bundle.ts"), join(app, "bundle.ts"));
			evidence.bundle = JSON.parse(
				(await command(["bun", "bundle.ts"], app)).out,
			);
			await command(["bun", "run", "test:types"], app);
		}
		console.log(`${name}: generated typecheck and Eve tool discovery passed`);
	}
	// The same external piece can be added to an already generated app.
	const existing = join(root, "frontend");
	const clientPath = join(existing, "chat.client.ts");
	const before = `${await readFile(clientPath, "utf8")}// developer-owned customization\n`;
	await writeFile(clientPath, before);
	await command(
		["node", cli, "add", external("svg"), "--cwd", existing, "--yes"],
		repo,
	);
	assert.equal(await readFile(clientPath, "utf8"), before);
	const proposed = join(existing, ".chatjs/proposals/chat.client.ts");
	assert.match(await readFile(proposed, "utf8"), /draw_svg/);
	// Test consumer explicitly adopts the concrete proposals after inspection.
	for (const file of [
		"chat.client.ts",
		"chat.selection.json",
		"chat.installation.json",
	])
		await cp(join(existing, ".chatjs/proposals", file), join(existing, file));
	await command(["bun", "run", "test:types"], existing);
	evidence.existingAppAdd = {
		originalClientPreserved: true,
		proposedSvgRegistration: true,
		adoptedTypecheck: "passed",
	};
	const negative = join(root, "compatible-negative");
	selections.negative = {
		items: [
			...shared,
			"@chatjs/layout-minimal",
			external("compatible-negative"),
		],
		settings: { model: "gpt-5-mini" },
	};
	await command(
		[
			"node",
			cli,
			"create",
			negative,
			"--selection",
			`${server.url.origin}/selection/negative`,
			"--yes",
		],
		repo,
	);
	const rejected = await command(
		["node", "node_modules/eve/bin/eve.js", "build"],
		negative,
		{ APP_DATABASE_URL: "postgres://fixture:fixture@127.0.0.1:1/unused" },
		false,
	);
	assert.notEqual(rejected.code, 0);
	assert.match(rejected.out + rejected.err, /context window metadata/);
	evidence.negativeModel = {
		typecheck: "passed",
		eveBuild:
			"rejected: missing context window metadata for unlisted provider identity",
	};
	await writeFile(
		join(root, "evidence.json"),
		`${JSON.stringify(evidence, null, 2)}\n`,
	);
	console.log(`Generated examples and receipts: ${root}`);
} finally {
	server.stop(true);
}
