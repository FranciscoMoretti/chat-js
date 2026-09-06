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
		assert(!pkg.dependencies["@ai-sdk/openai-compatible"]);
		if (name === "studio")
			assert(
				!(await Bun.file(join(app, "integrations/model.ts")).exists()),
				"Unselected official model source must be absent",
			);
		for (const dependency of [
			"files-sdk",
			"@vercel/sandbox",
			"@tavily/core",
			"@mendable/firecrawl-js",
			"papaparse",
		])
			assert(!pkg.dependencies[dependency]);
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
